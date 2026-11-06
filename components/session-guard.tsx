"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buildLoginHref, getCurrentRedirectPath } from "@/lib/auth-redirect";
import { useAuth } from "./auth-provider";
import { ConfigurationNotice } from "./configuration-notice";
import { LoadingScreen } from "./loading-screen";

/**
 * Session-only gate for static authenticated surfaces such as the user FAQ.
 *
 * Unlike `AuthGuard`, this component does not wait for privacy consent or
 * account approval. That is deliberate: the FAQ performs no Supabase data
 * reads and must remain reachable from the consent and approval holding
 * screens. Never put member or event data behind this gate.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isConfigured } = useAuth();
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

  return <>{children}</>;
}
