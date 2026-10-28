"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { ConfigurationNotice } from "./configuration-notice";
import { LoadingScreen } from "./loading-screen";

/**
 * Client-side gate for authenticated pages.
 *
 * This is a UX redirect only: Row Level Security on Supabase remains the real
 * authorization boundary for every query and mutation.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isConfigured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isConfigured && !isLoading && !user) {
      router.replace("/login");
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
