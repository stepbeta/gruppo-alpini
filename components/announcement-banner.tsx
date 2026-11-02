"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { MegaphoneIcon } from "./icons";
import {
  ANNOUNCEMENTS_CHANGED_EVENT,
  fetchCurrentAnnouncement,
  type Announcement,
} from "@/lib/announcements";

/**
 * Platform-wide announcement bar.
 *
 * It lives inside the sticky header and is rendered only after the session and
 * privacy gate allow access. Failures are intentionally silent: a missing
 * migration or a network hiccup must never break every authenticated page.
 */
export function AnnouncementBanner() {
  const { user } = useAuth();
  const userId = user?.id;
  const [current, setCurrent] = useState<{
    userId: string;
    announcement: Announcement | null;
  } | null>(null);

  useEffect(() => {
    if (!userId) return;

    const currentUserId = userId;
    let isActive = true;

    function load() {
      fetchCurrentAnnouncement().then(({ announcement: nextAnnouncement }) => {
        if (isActive) {
          setCurrent({ userId: currentUserId, announcement: nextAnnouncement });
        }
      });
    }

    load();

    window.addEventListener(ANNOUNCEMENTS_CHANGED_EVENT, load);
    window.addEventListener("focus", load);

    return () => {
      isActive = false;
      window.removeEventListener(ANNOUNCEMENTS_CHANGED_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, [userId]);

  // A previous user's banner must never flash after an account switch.
  const announcement =
    current && userId && current.userId === userId
      ? current.announcement
      : null;

  if (!announcement) return null;

  return (
    <div
      aria-label="Avviso del gruppo"
      className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/40"
      role="region"
    >
      <div className="mx-auto flex w-full max-w-5xl items-start gap-3 px-4 py-2.5 sm:px-6">
        <MegaphoneIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="whitespace-pre-line text-sm leading-6 text-amber-950 dark:text-amber-100">
          {announcement.message}
        </p>
      </div>
    </div>
  );
}
