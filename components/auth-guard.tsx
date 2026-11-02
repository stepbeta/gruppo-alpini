"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buildLoginHref, getCurrentRedirectPath } from "@/lib/auth-redirect";
import { useAuth } from "./auth-provider";
import { ConfigurationNotice } from "./configuration-notice";
import { LoadingScreen } from "./loading-screen";
import { PrivacyConsentGate } from "./privacy-consent-gate";

/**
 * Client-side gate for authenticated pages.
 *
 * This is a UX redirect only: Row Level Security on Supabase remains the real
 * authorization boundary for every query and mutation. The privacy gate is
 * backed by a restrictive RLS layer as well, so an account that has not
 * accepted the policy cannot read member data even through direct API calls.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isConfigured, consentStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConfigured && !isLoading && !user) {
      router.replace(buildLoginHref(getCurrentRedirectPath()));
    }
  }, [isConfigured, isLoading, user, router]);

  if (!isConfigured) {
    return <ConfigurationNotice />;
  }

  if (isLoading || !user) {
    return <LoadingScreen message="Verifica dell’accesso…" />;
  }

  if (consentStatus === "unknown" || consentStatus === "checking") {
    return <LoadingScreen message="Verifica del consenso privacy…" />;
  }

  if (consentStatus === "required" || consentStatus === "error") {
    return <PrivacyConsentGate />;
  }

  return <>{children}</>;
}
