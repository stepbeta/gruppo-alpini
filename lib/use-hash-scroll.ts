"use client";

import { useEffect } from "react";

/**
 * Re-applies the URL hash scroll once client-rendered content is ready.
 *
 * Next.js performs its hash scroll when the route commits. Sections that only
 * mount after a Supabase request (for example the search box on /iscritti or
 * the request form on /richieste) do not exist yet at that moment, so the
 * help-hub deep links need this second pass.
 */
export function useHashScroll(isReady: boolean) {
  useEffect(() => {
    if (!isReady) return;

    const hash = window.location.hash.slice(1);
    if (!hash) return;

    let targetId: string;
    try {
      targetId = decodeURIComponent(hash);
    } catch {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isReady]);
}
