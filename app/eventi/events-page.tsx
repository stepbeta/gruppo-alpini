"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { fetchMembers, fetchProfile, type Member } from "@/lib/profile";
import {
  fetchEventResponses,
  fetchEvents,
  formatEventError,
  type EventRecord,
  type EventResponseRecord,
} from "@/lib/events";
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  PlusIcon,
  XIcon,
} from "@/components/icons";
import { DeleteEventDialog } from "./delete-event-dialog";
import { EventCard } from "./event-card";
import { EventDialog } from "./event-dialog";

function eventTimestamp(event: EventRecord): number {
  const timestamp = new Date(event.event_date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * All-day events stay upcoming for their whole date; timed events switch to
 * past at their exact start time.
 */
function isEventPast(event: EventRecord, now: number): boolean {
  if (event.is_all_day) {
    const today = new Date(now);
    const startOfToday = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    return eventTimestamp(event) < startOfToday;
  }

  return eventTimestamp(event) < now;
}

export function EventsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [responses, setResponses] = useState<EventResponseRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    Promise.all([fetchEvents(), fetchProfile(userId)]).then(
      async ([eventsResult, profileResult]) => {
        if (!isActive) return;

        const baseError = eventsResult.error || profileResult.error;
        if (baseError) {
          setLoadError(formatEventError(baseError));
          setIsLoading(false);
          return;
        }

        const isAdminUser = profileResult.profile?.is_admin === true;
        const membersPromise: Promise<{
          members: Member[];
          error: string | null;
        }> = isAdminUser
          ? fetchMembers()
          : Promise.resolve({ members: [], error: null });

        const [responsesResult, membersResult] = await Promise.all([
          fetchEventResponses(),
          membersPromise,
        ]);

        if (!isActive) return;

        if (responsesResult.error) {
          setLoadError(formatEventError(responsesResult.error));
          setIsLoading(false);
          return;
        }

        setEvents(eventsResult.events);
        setResponses(responsesResult.responses);
        setMembers(membersResult.members);
        setMembersError(membersResult.error);
        setIsAdmin(isAdminUser);
        setNow(Date.now());
        setLoadError(null);
        setIsLoading(false);
      },
    );

    return () => {
      isActive = false;
    };
  }, [userId, reloadKey]);

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .filter((event) => !isEventPast(event, now))
        .sort((first, second) => eventTimestamp(first) - eventTimestamp(second)),
    [events, now],
  );

  const pastEvents = useMemo(
    () =>
      [...events]
        .filter((event) => isEventPast(event, now))
        .sort((first, second) => eventTimestamp(second) - eventTimestamp(first)),
    [events, now],
  );

  const responsesByEvent = useMemo(() => {
    const map = new Map<string, EventResponseRecord[]>();

    for (const response of responses) {
      const current = map.get(response.event_id) ?? [];
      current.push(response);
      map.set(response.event_id, current);
    }

    return map;
  }, [responses]);

  const myResponses = useMemo(() => {
    const map = new Map<string, EventResponseRecord>();

    for (const response of responses) {
      if (response.user_id === userId) {
        map.set(response.event_id, response);
      }
    }

    return map;
  }, [responses, userId]);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingEvent(null);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeletingEvent(null);
  }, []);

  function handleResponseSaved(updatedResponse: EventResponseRecord) {
    setResponses((current) => {
      const exists = current.some(
        (response) => response.id === updatedResponse.id,
      );

      return exists
        ? current.map((response) =>
            response.id === updatedResponse.id ? updatedResponse : response,
          )
        : [...current, updatedResponse];
    });

    const event = events.find(
      (item) => item.id === updatedResponse.event_id,
    );

    setNotice(
      `Risposta salvata per “${event?.title ?? "l’evento"}”.`,
    );
  }

  function handleEventCreated(createdEvent: EventRecord) {
    setEvents((current) => [...current, createdEvent]);
    setNow(Date.now());
    setIsCreateOpen(false);
    setNotice(`Evento creato: ${createdEvent.title}.`);
  }

  function handleEventUpdated(updatedEvent: EventRecord) {
    setEvents((current) =>
      current.map((event) =>
        event.id === updatedEvent.id ? updatedEvent : event,
      ),
    );
    setNow(Date.now());
    setEditingEvent(null);
    setNotice(`Evento aggiornato: ${updatedEvent.title}.`);
  }

  function handleEventDeleted(eventId: string) {
    const event = events.find((item) => item.id === eventId);

    setEvents((current) => current.filter((item) => item.id !== eventId));
    setResponses((current) =>
      current.filter((response) => response.event_id !== eventId),
    );
    setDeletingEvent(null);
    setNotice(`Evento eliminato: ${event?.title ?? "l’evento"}.`);
  }

  function handleOpenEdit(event: EventRecord) {
    setNotice(null);
    setEditingEvent(event);
  }

  function handleOpenDelete(event: EventRecord) {
    setNotice(null);
    setDeletingEvent(event);
  }

  function handleRetry() {
    setIsLoading(true);
    setLoadError(null);
    setMembersError(null);
    setReloadKey((current) => current + 1);
  }

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Calendario
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
              Eventi del gruppo
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-300">
              Consulta i prossimi appuntamenti e indica la tua presenza. Le
              risposte aiutano gli organizzatori a preparare al meglio ogni
              incontro.
            </p>
          </div>

          {isAdmin && !isLoading && !loadError ? (
            <button
              aria-haspopup="dialog"
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={() => {
                setNotice(null);
                setIsCreateOpen(true);
              }}
              type="button"
            >
              <PlusIcon className="h-5 w-5" />
              Nuovo evento
            </button>
          ) : null}
        </div>

        {notice ? (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            role="status"
          >
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button
              aria-label="Chiudi messaggio"
              className="rounded p-0.5 text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/60"
              onClick={() => setNotice(null)}
              type="button"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && isAdmin && membersError ? (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Impossibile caricare i nomi dei soci per il dettaglio delle
              adesioni: {formatEventError(membersError)}
            </span>
          </div>
        ) : null}

        {isLoading ? (
          <div
            aria-label="Caricamento degli eventi"
            className="mt-8 space-y-4"
            role="status"
          >
            {[0, 1].map((item) => (
              <div
                className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-zinc-900"
                key={item}
              >
                <div className="flex items-start gap-5">
                  <div className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
                  <div className="w-full space-y-3">
                    <div className="h-5 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-7 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40"
            role="alert"
          >
            <AlertCircleIcon className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" />
            <h2 className="mt-3 text-lg font-semibold text-red-900 dark:text-red-100">
              Impossibile caricare gli eventi
            </h2>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-red-700 dark:text-red-300">
              {loadError}
            </p>
            <button
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-600 dark:hover:bg-red-500"
              onClick={handleRetry}
              type="button"
            >
              Riprova
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError ? (
          <>
            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                  Prossimi eventi
                </h2>
                <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <CalendarIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  {upcomingEvents.length}{" "}
                  {upcomingEvents.length === 1 ? "evento" : "eventi"}
                </p>
              </div>

              {upcomingEvents.length > 0 ? (
                <ul className="mt-4 space-y-5">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      allResponses={responsesByEvent.get(event.id) ?? []}
                      event={event}
                      isAdmin={isAdmin}
                      isPast={false}
                      key={event.id}
                      members={isAdmin ? members : []}
                      onDelete={handleOpenDelete}
                      onEdit={handleOpenEdit}
                      onResponseSaved={handleResponseSaved}
                      response={myResponses.get(event.id)}
                      userId={userId}
                    />
                  ))}
                </ul>
              ) : (
                <div
                  className="mt-4 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  role="status"
                >
                  <CalendarIcon className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                  <h3 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                    Nessun evento in programma
                  </h3>
                  <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {isAdmin
                      ? "Crea il primo evento per iniziare a raccogliere le adesioni dei soci."
                      : "Gli eventi creati dagli amministratori compariranno qui."}
                  </p>
                  {isAdmin ? (
                    <button
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                      onClick={() => {
                        setNotice(null);
                        setIsCreateOpen(true);
                      }}
                      type="button"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Crea un evento
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            {pastEvents.length > 0 ? (
              <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                    Eventi passati
                  </h2>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {pastEvents.length}{" "}
                    {pastEvents.length === 1 ? "evento" : "eventi"}
                  </p>
                </div>

                <ul className="mt-4 space-y-5">
                  {pastEvents.map((event) => (
                    <EventCard
                      allResponses={responsesByEvent.get(event.id) ?? []}
                      event={event}
                      isAdmin={isAdmin}
                      isPast
                      key={event.id}
                      members={isAdmin ? members : []}
                      onDelete={handleOpenDelete}
                      onEdit={handleOpenEdit}
                      onResponseSaved={handleResponseSaved}
                      response={myResponses.get(event.id)}
                      userId={userId}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      <SiteFooter />

      {isAdmin && isCreateOpen ? (
        <EventDialog
          key="create-event"
          mode="create"
          onClose={handleCloseCreate}
          onSaved={handleEventCreated}
        />
      ) : null}

      {isAdmin && editingEvent ? (
        <EventDialog
          event={editingEvent}
          key={`edit-${editingEvent.id}`}
          mode="edit"
          onClose={handleCloseEdit}
          onSaved={handleEventUpdated}
        />
      ) : null}

      {isAdmin && deletingEvent ? (
        <DeleteEventDialog
          event={deletingEvent}
          onClose={handleCloseDelete}
          onDeleted={handleEventDeleted}
        />
      ) : null}
    </div>
  );
}
