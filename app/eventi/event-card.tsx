"use client";

import { useEffect, useRef, useState } from "react";
import { DELETED_MEMBER_NAME, type Member } from "@/lib/profile";
import {
  formatEventDate,
  formatEventError,
  getEventSharePath,
  saveEventResponse,
  type EventRecord,
  type EventResponseRecord,
  type EventResponseStatus,
} from "@/lib/events";
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  PencilIcon,
  ShareIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

const RSVP_OPTIONS = [
  {
    value: "present" as const,
    label: "Presente",
    icon: CheckCircleIcon,
    activeClass:
      "border-emerald-700 bg-emerald-700 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600",
  },
  {
    value: "tentative" as const,
    label: "In forse",
    icon: ClockIcon,
    activeClass:
      "border-amber-500 bg-amber-400 text-amber-950 shadow-sm dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950",
  },
  {
    value: "absent" as const,
    label: "Assente",
    icon: XIcon,
    activeClass:
      "border-zinc-700 bg-zinc-700 text-white shadow-sm dark:border-zinc-500 dark:bg-zinc-600",
  },
];

const RSVP_LABELS: Record<EventResponseStatus, string> = {
  present: "Presente",
  tentative: "In forse",
  absent: "Assente",
};

const ATTENDANCE_TONES = {
  present: {
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
    title: "text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    empty: "text-emerald-800/70 dark:text-emerald-200/70",
  },
  tentative: {
    card: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    title: "text-amber-900 dark:text-amber-100",
    dot: "bg-amber-500 dark:bg-amber-400",
    empty: "text-amber-800/70 dark:text-amber-200/70",
  },
  absent: {
    card: "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
    title: "text-zinc-800 dark:text-zinc-100",
    dot: "bg-zinc-500 dark:bg-zinc-400",
    empty: "text-zinc-500 dark:text-zinc-400",
  },
} as const;

const collator = new Intl.Collator("it", { sensitivity: "base" });

type ShareState = "idle" | "copied" | "error";

/**
 * Copies text even when the async Clipboard API is unavailable or blocked
 * (for example on an insecure origin or in an older browser).
 */
async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy copy path.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copia non riuscita.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function statusBadgeClass(status: EventResponseStatus | undefined): string {
  switch (status) {
    case "present":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300";
    case "tentative":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300";
    case "absent":
      return "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function memberDisplayName(member: Member): string {
  return member.full_name?.trim() || "Nome non indicato";
}

function AttendanceList({
  title,
  names,
  tone,
  empty,
}: {
  title: string;
  names: string[];
  tone: keyof typeof ATTENDANCE_TONES;
  empty: string;
}) {
  const styles = ATTENDANCE_TONES[tone];

  return (
    <div className={`rounded-xl border p-3 ${styles.card}`}>
      <p className={`text-sm font-semibold ${styles.title}`}>
        {title} ({names.length})
      </p>
      {names.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
          {names.map((name, index) => (
            <li className="flex items-start gap-2" key={`${name}-${index}`}>
              <span
                aria-hidden="true"
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
              />
              <span className="break-words">{name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-2 text-sm ${styles.empty}`}>{empty}</p>
      )}
    </div>
  );
}

type EventCardProps = {
  event: EventRecord;
  response: EventResponseRecord | undefined;
  allResponses: EventResponseRecord[];
  /** Members loaded for the responders visible on this page. */
  members: Member[];
  /** Total approved members, used for the "not responded" summary. */
  approvedMemberCount?: number;
  userId: string;
  isAdmin: boolean;
  isPast: boolean;
  isHighlighted: boolean;
  onResponseSaved: (response: EventResponseRecord) => void;
  onEdit: (event: EventRecord) => void;
  onDelete: (event: EventRecord) => void;
};

export function EventCard({
  event,
  response,
  allResponses,
  members,
  approvedMemberCount,
  userId,
  isAdmin,
  isPast,
  isHighlighted,
  onResponseSaved,
  onEdit,
  onDelete,
}: EventCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const shareResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shareResetTimer.current !== null) {
        window.clearTimeout(shareResetTimer.current);
      }
    };
  }, []);

  const formattedDate = formatEventDate(event.event_date, event.is_all_day);
  const statusLabel = response
    ? RSVP_LABELS[response.status]
    : "Non hai ancora risposto";

  const memberNames = new Map<string, string>();
  for (const member of members) {
    memberNames.set(member.id, memberDisplayName(member));
  }

  const namesByStatus: Record<EventResponseStatus, string[]> = {
    present: [],
    tentative: [],
    absent: [],
  };

  for (const item of allResponses) {
    const memberName = item.user_id
      ? memberNames.get(item.user_id) ?? "Socio"
      : DELETED_MEMBER_NAME;

    namesByStatus[item.status].push(memberName);
  }

  for (const names of Object.values(namesByStatus)) {
    names.sort((first, second) => collator.compare(first, second));
  }

  const inactiveResponderIds = new Set(
    members
      .filter((member) => member.approval_status !== "approved")
      .map((member) => member.id),
  );
  const respondedIds = new Set(
    allResponses
      .map((item) => item.user_id)
      .filter(
        (id): id is string => id !== null && !inactiveResponderIds.has(id),
      ),
  );
  const nonResponderCount =
    approvedMemberCount === undefined
      ? null
      : Math.max(0, approvedMemberCount - respondedIds.size);

  async function handleResponse(status: EventResponseStatus) {
    if (isSaving || isPast || response?.status === status) return;

    setIsSaving(true);
    setError(null);

    const { response: updatedResponse, error: saveError } =
      await saveEventResponse(event.id, userId, status);

    if (saveError || !updatedResponse) {
      setError(
        formatEventError(
          saveError ?? "Impossibile salvare la risposta. Riprova.",
        ),
      );
      setIsSaving(false);
      return;
    }

    onResponseSaved(updatedResponse);
    setIsSaving(false);
  }

  async function handleShare() {
    const shareUrl = new URL(
      getEventSharePath(event.id),
      window.location.origin,
    ).toString();
    const location = event.location?.trim();
    const shareText = location
      ? `${event.title} — ${formattedDate} — ${location}`
      : `${event.title} — ${formattedDate}`;

    if (shareResetTimer.current !== null) {
      window.clearTimeout(shareResetTimer.current);
      shareResetTimer.current = null;
    }
    setShareState("idle");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Evento: ${event.title}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (shareError) {
        if (
          shareError instanceof Error &&
          shareError.name === "AbortError"
        ) {
          return;
        }
        // The native sheet failed: fall back to copying the direct link.
      }
    }

    try {
      await copyTextToClipboard(shareUrl);
      setShareState("copied");
      shareResetTimer.current = window.setTimeout(() => {
        setShareState("idle");
        shareResetTimer.current = null;
      }, 3000);
    } catch {
      setShareState("error");
    }
  }

  return (
    <li
      className={`scroll-mt-28 overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-zinc-900 ${
        isHighlighted
          ? "border-emerald-400 ring-2 ring-emerald-300/70 dark:border-emerald-700 dark:ring-emerald-800"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
      id={`event-${event.id}`}
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
              {isPast ? "Evento concluso" : "Prossimo evento"}
            </p>
            {isHighlighted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <ShareIcon className="h-3.5 w-3.5" />
                Evento condiviso
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-label={`Condividi l’evento ${event.title}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              onClick={handleShare}
              type="button"
            >
              {shareState === "copied" ? (
                <CheckCircleIcon className="h-4 w-4" />
              ) : (
                <ShareIcon className="h-4 w-4" />
              )}
              {shareState === "copied" ? "Link copiato" : "Condividi"}
            </button>
            <span aria-live="polite" className="sr-only">
              {shareState === "copied"
                ? "Link dell’evento copiato negli appunti."
                : ""}
            </span>

            {isAdmin ? (
              <>
                <button
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => onEdit(event)}
                  type="button"
                >
                  <PencilIcon className="h-4 w-4" />
                  Modifica
                </button>
                <button
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                  onClick={() => onDelete(event)}
                  type="button"
                >
                  <TrashIcon className="h-4 w-4" />
                  Elimina
                </button>
              </>
            ) : null}
          </div>
        </div>

        {shareState === "error" ? (
          <p
            className="mt-2 text-sm font-medium text-red-700 dark:text-red-300"
            role="alert"
          >
            Impossibile copiare il link. Riprova.
          </p>
        ) : null}

        <div className="mt-3 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CalendarIcon className="h-7 w-7" />
          </div>

          <div className="min-w-0 flex-1">
            <time
              className="block text-lg font-semibold text-emerald-800 sm:text-xl dark:text-emerald-300"
              dateTime={event.event_date}
            >
              {formattedDate}
            </time>
            <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              {event.title}
            </h2>

            <div className="mt-2 flex items-start gap-2 text-base leading-7 text-zinc-600 dark:text-zinc-300">
              <MapPinIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span className="break-words">
                {event.location?.trim() || "Luogo da definire"}
              </span>
            </div>
          </div>
        </div>

        {event.description?.trim() ? (
          <p className="mt-5 whitespace-pre-line text-base leading-7 text-zinc-700 dark:text-zinc-300">
            {event.description}
          </p>
        ) : null}

        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                La tua risposta
              </p>
              <p
                aria-live="polite"
                className={`mt-1 inline-flex rounded-full px-3 py-1 text-base font-semibold ${statusBadgeClass(
                  response?.status,
                )}`}
              >
                {statusLabel}
              </p>
            </div>
            {isSaving ? (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
                />
                Salvataggio…
              </span>
            ) : null}
          </div>

          {!isPast ? (
            <div
              aria-label={`Risposta per ${event.title}`}
              className="mt-3 grid gap-2 sm:grid-cols-3"
              role="group"
            >
              {RSVP_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = response?.status === option.value;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-base font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? option.activeClass
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                    }`}
                    disabled={isSaving}
                    key={option.value}
                    onClick={() => handleResponse(option.value)}
                    type="button"
                  >
                    <Icon className="h-5 w-5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {error ? (
            <div
              className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-4.5 w-4.5 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Riepilogo adesioni
                </h3>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Risposte ricevute: {allResponses.length}
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <dt className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Presenti
                </dt>
                <dd className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {namesByStatus.present.length}
                </dd>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <dt className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  In forse
                </dt>
                <dd className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {namesByStatus.tentative.length}
                </dd>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white px-2 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <dt className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  Assenti
                </dt>
                <dd className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
                  {namesByStatus.absent.length}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Dettaglio per stato
              </h4>
              <div className="mt-2 grid gap-3 lg:grid-cols-3">
                <AttendanceList
                  empty="Nessun presente"
                  names={namesByStatus.present}
                  title="Presenti"
                  tone="present"
                />
                <AttendanceList
                  empty="Nessun in forse"
                  names={namesByStatus.tentative}
                  title="In forse"
                  tone="tentative"
                />
                <AttendanceList
                  empty="Nessun assente"
                  names={namesByStatus.absent}
                  title="Assenti"
                  tone="absent"
                />
              </div>
            </div>

            {nonResponderCount !== null &&
            approvedMemberCount !== undefined &&
            approvedMemberCount > 0 ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Non hanno ancora risposto ({nonResponderCount})
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {nonResponderCount === 0
                    ? "Tutti i soci hanno risposto."
                    : `${nonResponderCount} ${
                        nonResponderCount === 1 ? "socio" : "soci"
                      } non ${
                        nonResponderCount === 1 ? "ha" : "hanno"
                      } ancora indicato la propria presenza.`}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
