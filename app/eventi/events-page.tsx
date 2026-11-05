"use client";

/**
 * ============================================================================
 * EVENTI — REGOLA DI MANUTENZIONE
 * ============================================================================
 *
 * Whenever event listing views, filters, or page structures are modified in
 * the application, this file and any related UI components must be updated
 * simultaneously in the same pull request to keep the UI behavior and code
 * aligned.
 *
 * In pratica: se cambi le viste dell’elenco eventi, i filtri o la struttura
 * della pagina, aggiorna questo file, i componenti UI collegati e la
 * documentazione nello stesso pull request.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Pagination } from "@/components/pagination";
import { useAuth } from "@/components/auth-provider";
import {
  fetchMemberCount,
  fetchMembersByIds,
  fetchProfile,
  type Member,
} from "@/lib/profile";
import {
  fetchEventById,
  fetchEventResponses,
  fetchEvents,
  formatEventError,
  getEventIdFromSearch,
  isEventPast,
  type EventRecord,
  type EventResponseRecord,
} from "@/lib/events";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";
import { DeleteEventDialog } from "./delete-event-dialog";
import { EventCard } from "./event-card";
import { EventDialog } from "./event-dialog";
import { EventTemplatesDialog } from "./event-templates-dialog";

const EVENT_PAGE_SIZE = 5;

type EventScopeFilter = "all" | "upcoming" | "past";

const EVENT_SCOPE_FILTERS: ReadonlyArray<{
  value: EventScopeFilter;
  label: string;
}> = [
  { value: "all", label: "Tutti" },
  { value: "upcoming", label: "Prossimi" },
  { value: "past", label: "Passati" },
];

export function EventsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [upcomingEvents, setUpcomingEvents] = useState<EventRecord[]>([]);
  const [pastEvents, setPastEvents] = useState<EventRecord[]>([]);
  const [upcomingTotal, setUpcomingTotal] = useState(0);
  const [pastTotal, setPastTotal] = useState(0);
  const [upcomingPageCount, setUpcomingPageCount] = useState(0);
  const [pastPageCount, setPastPageCount] = useState(0);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const [scope, setScope] = useState<EventScopeFilter>("upcoming");

  const [responses, setResponses] = useState<EventResponseRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [approvedMemberCount, setApprovedMemberCount] = useState(0);
  const [responsesError, setResponsesError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const [sharedEventId, setSharedEventId] = useState<string | null>(null);
  const [sharedEvent, setSharedEvent] = useState<EventRecord | null>(null);

  const didLoadRef = useRef(false);
  const scrolledEventRef = useRef<string | null>(null);
  const upcomingSectionRef = useRef<HTMLElement>(null);
  const pastSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchProfile(userId).then(({ profile, error }) => {
      if (!isActive) return;

      if (error) {
        setProfileError(formatEventError(error));
        setIsLoading(false);
        return;
      }

      setProfileError(null);
      setIsAdmin(profile?.is_admin === true);
    });

    return () => {
      isActive = false;
    };
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId || !isAdmin) {
      return;
    }

    let isActive = true;

    fetchMemberCount("approved").then(({ count }) => {
      if (!isActive) return;
      setApprovedMemberCount(count);
    });

    return () => {
      isActive = false;
    };
  }, [userId, isAdmin, reloadKey]);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    if (didLoadRef.current) {
      setIsRefreshing(true);
    }

    Promise.all([
      fetchEvents({
        scope: "upcoming",
        page: upcomingPage,
        pageSize: EVENT_PAGE_SIZE,
        search: debouncedQuery,
      }),
      fetchEvents({
        scope: "past",
        page: pastPage,
        pageSize: EVENT_PAGE_SIZE,
        search: debouncedQuery,
      }),
    ]).then(([upcomingResult, pastResult]) => {
      if (!isActive) return;

      const nextError = upcomingResult.error ?? pastResult.error;

      if (nextError) {
        setEventsError(formatEventError(nextError));
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // A deletion (or a filter change) can leave the current page out of
      // range. Move to the last available page and let the effect refetch.
      if (upcomingPage > Math.max(1, upcomingResult.pageCount)) {
        setUpcomingPage(Math.max(1, upcomingResult.pageCount));
        setIsRefreshing(false);
        return;
      }

      if (pastPage > Math.max(1, pastResult.pageCount)) {
        setPastPage(Math.max(1, pastResult.pageCount));
        setIsRefreshing(false);
        return;
      }

      setUpcomingEvents(upcomingResult.events);
      setPastEvents(pastResult.events);
      setUpcomingTotal(upcomingResult.total);
      setPastTotal(pastResult.total);
      setUpcomingPageCount(upcomingResult.pageCount);
      setPastPageCount(pastResult.pageCount);
      setEventsError(null);
      setNow(Date.now());
      setIsLoading(false);
      setIsRefreshing(false);
      didLoadRef.current = true;
    });

    return () => {
      isActive = false;
    };
  }, [userId, upcomingPage, pastPage, debouncedQuery, reloadKey]);

  useEffect(() => {
    const linkedEventId = getEventIdFromSearch(window.location.search);
    if (!linkedEventId) return;

    let isActive = true;

    fetchEventById(linkedEventId).then(({ event, error }) => {
      if (!isActive) return;

      if (error) {
        setNotice(formatEventError(error));
        return;
      }

      if (!event) {
        setNotice("L’evento condiviso non è più disponibile.");
        return;
      }

      setSharedEventId(linkedEventId);
      setSharedEvent(event);
      const eventNow = Date.now();
      setNow(eventNow);
      setScope(isEventPast(event, eventNow) ? "past" : "upcoming");
    });

    return () => {
      isActive = false;
    };
  }, [userId]);

  const visibleEvents = useMemo(() => {
    const list = [...upcomingEvents, ...pastEvents];

    if (sharedEvent && !list.some((event) => event.id === sharedEvent.id)) {
      list.push(sharedEvent);
    }

    return list;
  }, [upcomingEvents, pastEvents, sharedEvent]);

  const visibleEventIds = useMemo(
    () => visibleEvents.map((event) => event.id),
    [visibleEvents],
  );

  useEffect(() => {
    if (!userId || visibleEventIds.length === 0) {
      return;
    }

    let isActive = true;

    fetchEventResponses(visibleEventIds).then((result) => {
      if (!isActive) return;

      if (result.error) {
        setResponses([]);
        setResponsesError(formatEventError(result.error));
        return;
      }

      setResponses(result.responses);
      setResponsesError(null);
    });

    return () => {
      isActive = false;
    };
  }, [userId, visibleEventIds]);

  // Only load the names of members who actually responded to the events on
  // screen, instead of downloading the whole directory. Deriving the ids from
  // `responses` also refreshes them when the signed-in administrator answers.
  const responderIds = useMemo(
    () => [
      ...new Set(
        responses
          .map((item) => item.user_id)
          .filter((id): id is string => id !== null),
      ),
    ],
    [responses],
  );

  useEffect(() => {
    if (!isAdmin || responderIds.length === 0) {
      return;
    }

    let isActive = true;

    fetchMembersByIds(responderIds).then((result) => {
      if (!isActive) return;

      setMembers(result.members);
      setMembersError(
        result.error ? formatEventError(result.error) : null,
      );
    });

    return () => {
      isActive = false;
    };
  }, [isAdmin, responderIds]);

  const isSharedEventVisible =
    sharedEventId !== null &&
    [...upcomingEvents, ...pastEvents].some(
      (event) => event.id === sharedEventId,
    );

  const sharedEventIsPast = sharedEvent
    ? isEventPast(sharedEvent, now)
    : false;

  const isSharedEventInScope =
    sharedEvent !== null &&
    (scope === "all" ||
      (scope === "upcoming" && !sharedEventIsPast) ||
      (scope === "past" && sharedEventIsPast));

  useEffect(() => {
    if (!sharedEventId || scrolledEventRef.current === sharedEventId) return;

    const element = document.getElementById(`event-${sharedEventId}`);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    scrolledEventRef.current = sharedEventId;
  }, [sharedEventId, upcomingEvents, pastEvents, sharedEvent]);

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

  const hasSearch = debouncedQuery.length > 0;
  const totalResults = upcomingTotal + pastTotal;
  const hasResults = totalResults > 0;
  const scopedTotal =
    scope === "upcoming"
      ? upcomingTotal
      : scope === "past"
        ? pastTotal
        : totalResults;
  const showGlobalEmptyState = hasSearch && !hasResults;
  const loadError = profileError ?? eventsError;

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

    const event = visibleEvents.find(
      (item) => item.id === updatedResponse.event_id,
    );

    setNotice(`Risposta salvata per “${event?.title ?? "l’evento"}”.`);
  }

  function handleEventCreated(createdEvent: EventRecord) {
    setUpcomingPage(1);
    setPastPage(1);
    setReloadKey((current) => current + 1);
    setIsCreateOpen(false);
    setScope("upcoming");
    setNotice(`Evento creato: ${createdEvent.title}.`);
  }

  function handleEventUpdated(updatedEvent: EventRecord) {
    setSharedEvent((current) =>
      current?.id === updatedEvent.id ? updatedEvent : current,
    );
    setReloadKey((current) => current + 1);
    setEditingEvent(null);
    setNotice(`Evento aggiornato: ${updatedEvent.title}.`);
  }

  function handleEventDeleted(eventId: string) {
    const event = visibleEvents.find((item) => item.id === eventId);

    if (sharedEventId === eventId) {
      setSharedEventId(null);
      setSharedEvent(null);
    }

    setUpcomingEvents((current) =>
      current.filter((item) => item.id !== eventId),
    );
    setPastEvents((current) => current.filter((item) => item.id !== eventId));
    setResponses((current) =>
      current.filter((response) => response.event_id !== eventId),
    );
    setReloadKey((current) => current + 1);
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
    setProfileError(null);
    setEventsError(null);
    setResponsesError(null);
    setMembersError(null);
    setReloadKey((current) => current + 1);
  }

  function handlePageChange(list: "upcoming" | "past", nextPage: number) {
    if (list === "upcoming") {
      setUpcomingPage(nextPage);
      upcomingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    setPastPage(nextPage);
    pastSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    setUpcomingPage(1);
    setPastPage(1);
  }

  function handleScopeChange(nextScope: EventScopeFilter) {
    setScope(nextScope);
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
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                aria-haspopup="dialog"
                className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                onClick={() => setIsTemplatesOpen(true)}
                type="button"
              >
                <CalendarIcon className="h-5 w-5" />
                Modelli evento
              </button>
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
            </div>
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

        {!isLoading && !loadError && responsesError && visibleEventIds.length > 0 ? (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Impossibile caricare le adesioni: {responsesError}
            </span>
          </div>
        ) : null}

        {!isLoading &&
        !loadError &&
        isAdmin &&
        membersError &&
        responderIds.length > 0 ? (
          <div
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Impossibile caricare i nomi dei soci per il dettaglio delle
              adesioni: {membersError}
            </span>
          </div>
        ) : null}

        {!isLoading && !loadError ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="sr-only" htmlFor="event-search">
              Cerca eventi per titolo, luogo o descrizione
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                autoComplete="off"
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-11 pr-11 text-base text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:appearance-none"
                id="event-search"
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Cerca per titolo, luogo o descrizione…"
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Azzera la ricerca"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => handleSearchChange("")}
                  type="button"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div
              aria-label="Filtra gli eventi"
              className="mt-3 flex flex-wrap gap-2"
              role="group"
            >
              {EVENT_SCOPE_FILTERS.map((filter) => {
                const isActive = scope === filter.value;
                const count =
                  filter.value === "all"
                    ? totalResults
                    : filter.value === "upcoming"
                      ? upcomingTotal
                      : pastTotal;

                return (
                  <button
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                      isActive
                        ? "border-emerald-700 bg-emerald-700 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                    }`}
                    key={filter.value}
                    onClick={() => handleScopeChange(filter.value)}
                    type="button"
                  >
                    {filter.label}
                    <span
                      className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p
                aria-live="polite"
                className="text-sm text-zinc-500 dark:text-zinc-400"
              >
                {isRefreshing ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
                    />
                    Aggiornamento del calendario…
                  </span>
                ) : hasSearch ? (
                  `${scopedTotal} ${
                    scopedTotal === 1 ? "risultato" : "risultati"
                  }`
                ) : scope === "upcoming" ? (
                  `${upcomingTotal} ${
                    upcomingTotal === 1 ? "prossimo evento" : "prossimi eventi"
                  }`
                ) : scope === "past" ? (
                  `${pastTotal} ${
                    pastTotal === 1 ? "evento passato" : "eventi passati"
                  }`
                ) : (
                  `${upcomingTotal} ${
                    upcomingTotal === 1 ? "prossimo evento" : "prossimi eventi"
                  } · ${pastTotal} ${
                    pastTotal === 1 ? "evento passato" : "eventi passati"
                  }`
                )}
              </p>
              {hasSearch ? (
                <button
                  className="rounded text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                  onClick={() => handleSearchChange("")}
                  type="button"
                >
                  Azzera ricerca
                </button>
              ) : null}
            </div>
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
            {showGlobalEmptyState ? (
              <div
                className="mt-8 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                role="status"
              >
                <SearchIcon className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                <h2 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  Nessun evento trovato
                </h2>
                <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  Non ci sono risultati per “{query.trim()}”. Prova con un altro
                  titolo, un altro luogo o una parola della descrizione.
                </p>
                <button
                  className="mt-5 inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                  onClick={() => handleSearchChange("")}
                  type="button"
                >
                  Azzera ricerca
                </button>
              </div>
            ) : null}

            {sharedEvent && !isSharedEventVisible && isSharedEventInScope ? (
              <section className="mt-8 scroll-mt-24">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                    Evento condiviso
                  </h2>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Aperto dal link che hai ricevuto
                  </p>
                </div>

                <ul className="mt-4 space-y-5">
                  <EventCard
                    allResponses={responsesByEvent.get(sharedEvent.id) ?? []}
                    approvedMemberCount={
                      isAdmin ? approvedMemberCount : undefined
                    }
                    event={sharedEvent}
                    isAdmin={isAdmin}
                    isHighlighted
                    isPast={sharedEventIsPast}
                    members={isAdmin ? members : []}
                    onDelete={handleOpenDelete}
                    onEdit={handleOpenEdit}
                    onResponseSaved={handleResponseSaved}
                    response={myResponses.get(sharedEvent.id)}
                    userId={userId}
                  />
                </ul>
              </section>
            ) : null}

            {!showGlobalEmptyState &&
            scope !== "past" &&
            (upcomingTotal > 0 || !hasSearch || scope === "upcoming") ? (
              <section
                className="mt-8 scroll-mt-24"
                ref={upcomingSectionRef}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                    Prossimi eventi
                  </h2>
                  <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <CalendarIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    {upcomingTotal}{" "}
                    {upcomingTotal === 1 ? "evento" : "eventi"}
                  </p>
                </div>

                {upcomingEvents.length > 0 ? (
                  <>
                    <ul className="mt-4 space-y-5">
                      {upcomingEvents.map((event) => (
                        <EventCard
                          allResponses={
                            responsesByEvent.get(event.id) ?? []
                          }
                          approvedMemberCount={
                            isAdmin ? approvedMemberCount : undefined
                          }
                          event={event}
                          isAdmin={isAdmin}
                          isHighlighted={event.id === sharedEventId}
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
                    <Pagination
                      className="mt-4"
                      disabled={isRefreshing}
                      itemLabel="eventi"
                      onPageChange={(nextPage) =>
                        handlePageChange("upcoming", nextPage)
                      }
                      page={upcomingPage}
                      pageCount={upcomingPageCount}
                      pageSize={EVENT_PAGE_SIZE}
                      total={upcomingTotal}
                    />
                  </>
                ) : (
                  <div
                    className="mt-4 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    role="status"
                  >
                    <CalendarIcon className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                    <h3 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {hasSearch
                        ? "Nessun prossimo evento trovato"
                        : "Nessun evento in programma"}
                    </h3>
                    {hasSearch ? (
                      <>
                        <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          Non ci sono prossimi eventi per “{query.trim()}”.
                          {pastTotal > 0
                            ? ` ${pastTotal} ${
                                pastTotal === 1
                                  ? "evento passato corrisponde"
                                  : "eventi passati corrispondono"
                              } invece alla ricerca.`
                            : ""}
                        </p>
                        {pastTotal > 0 ? (
                          <button
                            className="mt-5 inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                            onClick={() => handleScopeChange("past")}
                            type="button"
                          >
                            Mostra gli eventi passati
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                )}
              </section>
            ) : null}

            {!showGlobalEmptyState &&
            scope !== "upcoming" &&
            (pastTotal > 0 || scope === "past") ? (
              <section
                className="mt-10 scroll-mt-24 border-t border-zinc-200 pt-8 dark:border-zinc-800"
                ref={pastSectionRef}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                    Eventi passati
                  </h2>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {pastTotal}{" "}
                    {pastTotal === 1 ? "evento" : "eventi"}
                  </p>
                </div>

                {pastEvents.length > 0 ? (
                  <>
                    <ul className="mt-4 space-y-5">
                      {pastEvents.map((event) => (
                        <EventCard
                          allResponses={
                            responsesByEvent.get(event.id) ?? []
                          }
                          approvedMemberCount={
                            isAdmin ? approvedMemberCount : undefined
                          }
                          event={event}
                          isAdmin={isAdmin}
                          isHighlighted={event.id === sharedEventId}
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

                    <Pagination
                      className="mt-4"
                      disabled={isRefreshing}
                      itemLabel="eventi"
                      onPageChange={(nextPage) =>
                        handlePageChange("past", nextPage)
                      }
                      page={pastPage}
                      pageCount={pastPageCount}
                      pageSize={EVENT_PAGE_SIZE}
                      total={pastTotal}
                    />
                  </>
                ) : (
                  <div
                    className="mt-4 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    role="status"
                  >
                    <CalendarIcon className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-500" />
                    <h3 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      {hasSearch
                        ? "Nessun evento passato trovato"
                        : "Nessun evento passato"}
                    </h3>
                    {hasSearch ? (
                      <>
                        <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          Non ci sono eventi passati per “{query.trim()}”.
                          {upcomingTotal > 0
                            ? ` ${upcomingTotal} ${
                                upcomingTotal === 1
                                  ? "evento prossimo corrisponde"
                                  : "eventi prossimi corrispondono"
                              } invece alla ricerca.`
                            : ""}
                        </p>
                        {upcomingTotal > 0 ? (
                          <button
                            className="mt-5 inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                            onClick={() => handleScopeChange("upcoming")}
                            type="button"
                          >
                            Mostra gli eventi prossimi
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                        Gli eventi conclusi compariranno qui dopo la loro data.
                      </p>
                    )}
                  </div>
                )}
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

      {isAdmin && isTemplatesOpen ? (
        <EventTemplatesDialog onClose={() => setIsTemplatesOpen(false)} />
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
