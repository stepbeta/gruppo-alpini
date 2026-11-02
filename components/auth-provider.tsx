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
import { fetchCurrentConsent, recordConsent } from "@/lib/consent";
import { supabase } from "@/lib/supabase";

export type ConsentStatus =
  | "unknown"
  | "checking"
  | "required"
  | "accepted"
  | "error";

type ConsentCheck =
  | { userId: string; status: "accepted" }
  | { userId: string; status: "required" }
  | { userId: string; status: "error"; message: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<{ error: string | null }>;
  consentStatus: ConsentStatus;
  consentError: string | null;
  acceptConsent: () => Promise<{ error: string | null }>;
  retryConsent: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(supabase !== null);
  const [consentCheck, setConsentCheck] = useState<ConsentCheck | null>(null);
  const [consentCheckAttempt, setConsentCheckAttempt] = useState(0);

  const userId = session?.user?.id ?? null;

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

  const signOut = useCallback(async () => {
    if (!supabase) {
      return { error: "Supabase non configurato." };
    }

    try {
      const { error } = await supabase.auth.signOut();
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isConfigured: supabase !== null,
      signOut,
      consentStatus,
      consentError,
      acceptConsent,
      retryConsent,
    }),
    [
      session,
      isLoading,
      signOut,
      consentStatus,
      consentError,
      acceptConsent,
      retryConsent,
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
