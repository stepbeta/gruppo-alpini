"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { formatAuthError } from "@/lib/auth-actions";
import { clearPostAuthRedirect } from "@/lib/auth-redirect";
import { fetchCurrentConsent, recordConsent } from "@/lib/consent";
import {
  fetchProfile,
  formatProfileError,
  type ApprovalStatus as MemberApprovalStatus,
  type Profile,
} from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export type ConsentStatus =
  | "unknown"
  | "checking"
  | "required"
  | "accepted"
  | "error";

/**
 * Account approval state used by `AuthGuard`.
 *
 * `unknown` means there is no signed-in user or consent has not been checked
 * yet. `checking` is derived while the profile request is in flight.
 */
export type ApprovalStatus =
  | "unknown"
  | "checking"
  | MemberApprovalStatus
  | "error";

type ConsentCheck =
  | { userId: string; status: "accepted" }
  | { userId: string; status: "required" }
  | { userId: string; status: "error"; message: string };

type ApprovalCheck =
  | {
      userId: string;
      status: MemberApprovalStatus;
      profile: Profile;
    }
  | { userId: string; status: "error"; message: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  /** True once the signed-in member's profile has loaded as an administrator. */
  isAdmin: boolean;
  signOut: () => Promise<{ error: string | null }>;
  consentStatus: ConsentStatus;
  consentError: string | null;
  acceptConsent: () => Promise<{ error: string | null }>;
  retryConsent: () => void;
  approvalStatus: ApprovalStatus;
  approvalError: string | null;
  retryApproval: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(supabase !== null);
  const [consentCheck, setConsentCheck] = useState<ConsentCheck | null>(null);
  const [consentCheckAttempt, setConsentCheckAttempt] = useState(0);
  const [approvalCheck, setApprovalCheck] = useState<ApprovalCheck | null>(null);
  const [approvalCheckAttempt, setApprovalCheckAttempt] = useState(0);

  const userId = session?.user?.id ?? null;

  const isConsentCheckCurrent = consentCheck?.userId === userId;
  const consentStatus: ConsentStatus = !userId
    ? "unknown"
    : isConsentCheckCurrent
      ? consentCheck.status
      : "checking";
  const consentError =
    isConsentCheckCurrent && consentCheck.status === "error"
      ? consentCheck.message
      : null;

  // The profile query is also protected by the consent RLS layer, so it can
  // only be attempted after the current policy has been accepted.
  const approvalStatus: ApprovalStatus = !userId
    ? "unknown"
    : consentStatus !== "accepted"
      ? "unknown"
      : approvalCheck && approvalCheck.userId === userId
        ? approvalCheck.status
        : "checking";
  const approvalError =
    approvalCheck &&
    approvalCheck.userId === userId &&
    approvalCheck.status === "error"
      ? approvalCheck.message
      : null;
  const isAdmin =
    consentStatus === "accepted" &&
    approvalCheck !== null &&
    approvalCheck.userId === userId &&
    "profile" in approvalCheck &&
    approvalCheck.profile.is_admin === true;

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive) return;
        setSession(data.session);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isActive) return;
        setSession(null);
        setIsLoading(false);
      });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    let isActive = true;

    // The "checking" status is derived during render when no check exists for
    // the current user yet, so this effect only writes state from the callback.
    fetchCurrentConsent(userId).then(({ accepted, error }) => {
      if (!isActive) return;

      if (error) {
        setConsentCheck({ userId, status: "error", message: error });
        return;
      }

      setConsentCheck({
        userId,
        status: accepted ? "accepted" : "required",
      });
    });

    return () => {
      isActive = false;
    };
  }, [userId, consentCheckAttempt]);

  useEffect(() => {
    if (!supabase || !userId || consentStatus !== "accepted") {
      return;
    }

    let isActive = true;

    fetchProfile(userId).then(({ profile, error }) => {
      if (!isActive) return;

      if (error) {
        setApprovalCheck({
          userId,
          status: "error",
          message: formatProfileError(error),
        });
        return;
      }

      if (!profile) {
        setApprovalCheck({
          userId,
          status: "error",
          message:
            "La scheda del socio non è disponibile. Contatta un amministratore.",
        });
        return;
      }

      setApprovalCheck({
        userId,
        // Mirrors `is_current_user_approved()`: administrators keep access even
        // if their own row is pending or rejected, so a bad status can never
        // lock every administrator out of account repair.
        status: profile.is_admin ? "approved" : profile.approval_status,
        profile,
      });
    });

    return () => {
      isActive = false;
    };
  }, [userId, consentStatus, approvalCheckAttempt]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return { error: "Supabase non configurato." };
    }

    try {
      const { error } = await supabase.auth.signOut();

      if (!error) {
        // A different account must not inherit a deep link from this session.
        clearPostAuthRedirect();
      }

      return { error: error ? formatAuthError(error) : null };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? formatAuthError(error)
            : "Errore di rete. Controlla la connessione e riprova.",
      };
    }
  }, []);

  const acceptConsent = useCallback(async () => {
    if (!userId) {
      return { error: "Sessione non disponibile. Accedi di nuovo." };
    }

    const { error } = await recordConsent(userId);

    if (error) {
      return { error };
    }

    setConsentCheck({ userId, status: "accepted" });
    return { error: null };
  }, [userId]);

  const retryConsent = useCallback(() => {
    setConsentCheck(null);
    setConsentCheckAttempt((attempt) => attempt + 1);
  }, []);

  const retryApproval = useCallback(() => {
    setApprovalCheck(null);
    setApprovalCheckAttempt((attempt) => attempt + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isConfigured: supabase !== null,
      isAdmin,
      signOut,
      consentStatus,
      consentError,
      acceptConsent,
      retryConsent,
      approvalStatus,
      approvalError,
      retryApproval,
    }),
    [
      session,
      isLoading,
      isAdmin,
      signOut,
      consentStatus,
      consentError,
      acceptConsent,
      retryConsent,
      approvalStatus,
      approvalError,
      retryApproval,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
