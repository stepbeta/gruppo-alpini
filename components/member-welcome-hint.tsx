"use client";

/**
 * ============================================================================
 * CONTEXTUAL GUIDANCE — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever features, workflows, validation rules, or routes are modified in
 * the application, these contextual helpers, empty states, and error messages
 * must be reviewed and updated simultaneously in the same pull request to keep
 * user guidance fully aligned with the current code.
 *
 * In pratica: se aggiungi, rimuovi o rinomini una rotta o un’azione per i soci,
 * aggiorna i collegamenti e i testi di questo promemoria nello stesso PR.
 * ============================================================================
 */

import { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarIcon,
  MailIcon,
  MountainIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

const STORAGE_KEY_PREFIX = "gruppo-alpini:welcome-hint-dismissed:v1";
const STORAGE_CHANGE_EVENT = "gruppo-alpini:welcome-hint-change";

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  };
}

function readDismissed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    // Private browsing or disabled storage: keep the hint available.
    return false;
  }
}

const HINT_ACTIONS = [
  {
    href: "/eventi",
    title: "Eventi e adesioni",
    description: "Consulta il calendario e indica la tua presenza.",
    icon: CalendarIcon,
  },
  {
    href: "/iscritti",
    title: "Lista iscritti",
    description: "Cerca un socio per nome o luogo di servizio.",
    icon: UsersIcon,
  },
  {
    href: "/richieste",
    title: "Richieste alla segreteria",
    description: "Scrivi un messaggio e segui lo stato della risposta.",
    icon: MailIcon,
  },
  {
    href: "/profile",
    title: "Il tuo profilo",
    description: "Tieni aggiornati nome, data di nascita e luogo di servizio.",
    icon: UserIcon,
  },
] as const;

type MemberWelcomeHintProps = {
  userId: string;
};

/**
 * Dismissible onboarding card shown on the home page for approved members.
 *
 * The dismissal is stored per account so it survives reloads without hiding
 * the guidance for another member using the same browser.
 */
export function MemberWelcomeHint({ userId }: MemberWelcomeHintProps) {
  const titleId = useId();
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}`;
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const isDismissed = useSyncExternalStore(
    subscribeToStorage,
    () => readDismissed(storageKey),
    () => false,
  );

  function handleDismiss() {
    setDismissedLocally(true);

    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage unavailable (private browsing or quotas): the hint stays
      // hidden for this session and reappears on the next visit.
    }

    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
  }

  if (isDismissed || dismissedLocally) return null;

  return (
    <aside
      aria-labelledby={titleId}
      className="mt-6 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm sm:p-6 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <MountainIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              Promemoria di benvenuto
            </p>
            <h2
              className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              id={titleId}
            >
              Il portale in quattro mosse
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Ecco le azioni più utili per iniziare: puoi tornare a questa home
              in qualsiasi momento per ritrovarle.
            </p>
          </div>
        </div>
        <button
          aria-label="Nascondi il promemoria di benvenuto"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-emerald-100 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-400 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-200"
          onClick={handleDismiss}
          type="button"
        >
          <XIcon className="h-4.5 w-4.5" />
        </button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {HINT_ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <li key={action.href}>
              <Link
                className="group flex h-full items-center gap-3 rounded-2xl border border-emerald-100 bg-white/80 p-3.5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-900/70 dark:bg-zinc-950/40 dark:hover:border-emerald-800 dark:hover:bg-zinc-950/70"
                href={action.href}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {action.description}
                  </span>
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400" />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Puoi chiudere questo promemoria con la X: non comparirà più sul tuo
        account. Le quattro sezioni restano sempre raggiungibili dal menu.
      </p>
    </aside>
  );
}
