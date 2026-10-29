"use client";

import { useState } from "react";
import {
  formatEventDate,
  formatEventError,
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

type EventCardProps = {
  event: EventRecord;
  response: EventResponseRecord | undefined;
  allResponses: EventResponseRecord[];
  userId: string;
  isAdmin: boolean;
  isPast: boolean;
  onResponseSaved: (response: EventResponseRecord) => void;
};

export function EventCard({
  event,
  response,
  allResponses,
  userId,
  isAdmin,
  isPast,
  onResponseSaved,
}: EventCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateParts = formatEventDate(event.event_date);
  const statusLabel = response
    ? RSVP_LABELS[response.status]
    : "Non hai ancora risposto";

  const counts = { present: 0, tentative: 0, absent: 0 };
  for (const item of allResponses) {
    counts[item.status] += 1;
  }
  const totalResponses = allResponses.length;

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

  return (
    <li className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900 sm:h-18 sm:w-18 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="text-2xl font-bold leading-none sm:text-3xl">
              {dateParts?.day ?? "—"}
            </span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wide">
              {dateParts?.month ?? "data"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
              <CalendarIcon className="h-4 w-4" />
              {isPast
                ? "Evento concluso"
                : (dateParts?.weekday ?? "Data da definire")}
            </p>
            <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              {event.title}
            </h2>

            <div className="mt-3 flex flex-col gap-2 text-base leading-7 text-zinc-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 dark:text-zinc-300">
              <span className="inline-flex items-start gap-2">
                <CalendarIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span>
                  {dateParts
                    ? `${dateParts.fullDate} · ${dateParts.time}`
                    : "Data da definire"}
                </span>
              </span>
              <span className="inline-flex items-start gap-2">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span className="break-words">
                  {event.location?.trim() || "Luogo da definire"}
                </span>
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
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4.5 w-4.5 text-zinc-500 dark:text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Riepilogo adesioni
              </h3>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <dt className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Presenti
                </dt>
                <dd className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {counts.present}
                </dd>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <dt className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  In forse
                </dt>
                <dd className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {counts.tentative}
                </dd>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white px-2 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <dt className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  Assenti
                </dt>
                <dd className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
                  {counts.absent}
                </dd>
              </div>
            </dl>

            {totalResponses === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Nessuna risposta ricevuta.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
