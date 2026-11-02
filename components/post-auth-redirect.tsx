"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { consumePostAuthRedirect } from "@/lib/auth-redirect";
import { useAuth } from "./auth-provider";

/**
 * Completes deep links that had to survive a full-page OAuth or email
 * confirmation round trip.
 *
 * Supabase returns those flows to the site origin, so `rememberPostAuthRedirect`
 * stores the intended page in sessionStorage. This component waits until the
 * session and privacy consent are ready, then sends the member there.
 */
export function PostAuthRedirect() {
  const { user, isLoading, consentStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user || consentStatus !== "accepted") return;

    const nextPath = consumePostAuthRedirect();
    if (nextPath) router.replace(nextPath);
  }, [consentStatus, isLoading, router, user]);

  return null;
}
