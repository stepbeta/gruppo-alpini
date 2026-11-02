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
 * session, privacy consent and account approval are ready, then sends the
 * member there. A pending account keeps the destination until an administrator
 * approves it.
 */
export function PostAuthRedirect() {
  const { user, isLoading, consentStatus, approvalStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (
      isLoading ||
      !user ||
      consentStatus !== "accepted" ||
      approvalStatus !== "approved"
    ) {
      return;
    }

    const nextPath = consumePostAuthRedirect();
    if (nextPath) router.replace(nextPath);
  }, [approvalStatus, consentStatus, isLoading, router, user]);

  return null;
}
