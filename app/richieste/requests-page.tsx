"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Pagination } from "@/components/pagination";
import { useAuth } from "@/components/auth-provider";
import { getInitials } from "@/lib/display";
import {
  DELETED_MEMBER_NAME,
  fetchMembersByIds,
  fetchProfile,
  type Member,
} from "@/lib/profile";
import {
  createGenericRequest,
  fetchGenericRequests,
  fetchRequestCounts,
  formatRequestDate,
  formatRequestError,
  REQUEST_STATUS_LABELS,
  updateGenericRequestStatus,
  type GenericRequestRecord,
  type GenericRequestStatus,
  type RequestCounts,
} from "@/lib/requests";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  MailIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/icons";

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const MAX_MESSAGE_LENGTH = 2000;
const MY_PAGE_SIZE = 5;
const BOARD_PAGE_SIZE = 6;

type StatusFilter = "all" | GenericRequestStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "open", label: "In attesa" },
  { value: "resolved", label: "Risolte" },
];

const EMPTY_COUNTS: RequestCounts = {
  total: 0,
  open: 0,
  resolved: 0,
  error: null,
};

function RequestStatusBadge({ status }: { status: GenericRequestStatus }) {
  const isResolved = status === "resolved";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isResolved
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {isResolved ? (
        <CheckCircleIcon className="h-3.5 w-3.5" />
      ) : (
        <ClockIcon className="h-3.5 w-3.5" />
      )}
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const messageFieldId = useId();

  const [myRequests, setMyRequests] = useState<GenericRequestRecord[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [myPageCount, setMyPageCount] = useState(0);
  const [myPage, setMyPage] = useState(1);
  const [myError, setMyError] = useState<string | null>(null);
  const [isMyRefreshing, setIsMyRefreshing] = useState(false);

  const [boardRequests, setBoardRequests] = useState<GenericRequestRecord[]>(
    [],
  );
  const [boardTotal, setBoardTotal] = useState(0);
  const [boardPageCount, setBoardPageCount] = useState(0);
  const [boardPage, setBoardPage] = useState(1);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [isBoardRefreshing, setIsBoardRefreshing] = useState(false);
  const [boardQuery, setBoardQuery] = useState("");
  const debouncedBoardQuery = useDebouncedValue(boardQuery.trim(), 350);
  const [requestCounts, setRequestCounts] =
    useState<RequestCounts>(EMPTY_COUNTS);

  const [members, setMembers] = useState<Member[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const myDidLoadRef = useRef(false);
  const boardDidLoadRef = useRef(false);
  const mySectionRef = useRef<HTMLElement>(null);
  const boardSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchProfile(userId).then(({ profile, error }) => {
      if (!isActive) return;

      if (error) {
        setProfileError(formatRequestError(error));
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
    if (!userId) return;

    let isActive = true;

    if (myDidLoadRef.current) {
      setIsMyRefreshing(true);
    }

    fetchGenericRequests({
      scope: "mine",
      userId,
      page: myPage,
      pageSize: MY_PAGE_SIZE,
    }).then((result) => {
      if (!isActive) return;

      if (result.error) {
        setMyError(formatRequestError(result.error));
        setIsLoading(false);
        setIsMyRefreshing(false);
        return;
      }

      if (myPage > Math.max(1, result.pageCount)) {
        setMyPage(Math.max(1, result.pageCount));
        setIsLoading(false);
        setIsMyRefreshing(false);
        return;
      }

      setMyRequests(result.requests);
      setMyTotal(result.total);
      setMyPageCount(result.pageCount);
      setMyError(null);
      setIsLoading(false);
      setIsMyRefreshing(false);
      myDidLoadRef.current = true;
    });

    return () => {
      isActive = false;
    };
  }, [userId, myPage, reloadKey]);

  useEffect(() => {
    if (!userId || !isAdmin) return;

    let isActive = true;

    if (boardDidLoadRef.current) {
      setIsBoardRefreshing(true);
    }

    fetchGenericRequests({
      scope: "all",
      page: boardPage,
      pageSize: BOARD_PAGE_SIZE,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: debouncedBoardQuery,
    }).then((result) => {
      if (!isActive) return;

      if (result.error) {
        setBoardError(formatRequestError(result.error));
        setIsBoardLoading(false);
        setIsBoardRefreshing(false);
        return;
      }

      if (boardPage > Math.max(1, result.pageCount)) {
        setBoardPage(Math.max(1, result.pageCount));
        setIsBoardLoading(false);
        setIsBoardRefreshing(false);
        return;
      }

      setBoardRequests(result.requests);
      setBoardTotal(result.total);
      setBoardPageCount(result.pageCount);
      setBoardError(null);
      setIsBoardLoading(false);
      setIsBoardRefreshing(false);
      boardDidLoadRef.current = true;
    });

    return () => {
      isActive = false;
    };
  }, [
    userId,
    isAdmin,
    boardPage,
    statusFilter,
    debouncedBoardQuery,
    reloadKey,
  ]);

  useEffect(() => {
    if (!userId || !isAdmin) {
      return;
    }

    let isActive = true;

    fetchRequestCounts(debouncedBoardQuery).then((result) => {
      if (!isActive) return;
      setRequestCounts(result);
    });

    return () => {
      isActive = false;
    };
  }, [userId, isAdmin, debouncedBoardQuery, reloadKey]);

  const boardMemberIds = useMemo(
    () => [
      ...new Set(
        boardRequests
          .map((request) => request.user_id)
          .filter((id): id is string => id !== null),
      ),
    ],
    [boardRequests],
  );

  useEffect(() => {
    if (!isAdmin || boardMemberIds.length === 0) {
      return;
    }

    let isActive = true;

    fetchMembersByIds(boardMemberIds).then((result) => {
      if (!isActive) return;

      setMembers(result.members);
      setMembersError(
        result.error ? formatRequestError(result.error) : null,
      );
    });

    return () => {
      isActive = false;
    };
  }, [isAdmin, boardMemberIds]);

  const memberNames = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          member.full_name?.trim() || "Socio",
        ]),
      ),
    [members],
  );

  const hasBoardSearch = debouncedBoardQuery.length > 0;
  const isBoardFiltered = statusFilter !== "all" || hasBoardSearch;
  const loadError = profileError ?? myError;

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setFormError(null);
    setNotice(null);

    if (!userId) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setFormError("Scrivi il testo della richiesta.");
      return;
    }

    setIsSubmitting(true);

    const result = await createGenericRequest(userId, trimmedMessage);
    const createdRequest = result.request;

    if (result.error || !createdRequest) {
      setFormError(
        formatRequestError(
          result.error ?? "Impossibile inviare la richiesta. Riprova.",
        ),
      );
      setIsSubmitting(false);
      return;
    }

    setMessage("");
    setNotice("Richiesta inviata alla segreteria.");
    setMyPage(1);
    setReloadKey((current) => current + 1);
    setIsSubmitting(false);
  }

  async function handleStatusChange(
    requestId: string,
    status: GenericRequestStatus,
  ) {
    setAdminError(null);
    setNotice(null);
    setUpdatingId(requestId);

    const result = await updateGenericRequestStatus(requestId, status);
    const updatedRequest = result.request;

    if (result.error || !updatedRequest) {
      setAdminError(
        formatRequestError(
          result.error ?? "Impossibile aggiornare la richiesta. Riprova.",
        ),
      );
      setUpdatingId(null);
      return;
    }

    setNotice(
      status === "resolved"
        ? "Richiesta segnata come risolta."
        : "Richiesta riaperta.",
    );
    setUpdatingId(null);
    setReloadKey((current) => current + 1);
  }

  function handleRetry() {
    setIsLoading(true);
    setProfileError(null);
    setMyError(null);
    setBoardError(null);
    setMembersError(null);
    setReloadKey((current) => current + 1);
  }

  function handleMyPageChange(nextPage: number) {
    setMyPage(nextPage);
    mySectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleBoardPageChange(nextPage: number) {
    setBoardPage(nextPage);
    boardSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleStatusFilterChange(nextFilter: StatusFilter) {
    setStatusFilter(nextFilter);
    setBoardPage(1);
  }

  function handleBoardSearchChange(value: string) {
    setBoardQuery(value);
    setBoardPage(1);
  }

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
            Segreteria
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Richieste e comunicazioni
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-300">
            Invia una richiesta, un chiarimento o una nota alla segreteria del
            gruppo. Puoi seguire qui lo stato delle tue comunicazioni.
          </p>
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

        {isLoading ? (
          <div
            aria-label="Caricamento delle richieste"
            className="mt-8 grid gap-5 lg:grid-cols-5"
            role="status"
          >
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="mt-4 h-36 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="mt-4 h-10 w-1/2 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="h-5 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="mt-4 space-y-3">
                {[0, 1].map((item) => (
                  <div
                    className="h-24 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
                    key={item}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40"
            role="alert"
          >
            <AlertCircleIcon className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" />
            <h2 className="mt-3 text-lg font-semibold text-red-900 dark:text-red-100">
              Impossibile caricare le richieste
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
            <div className="mt-8 grid gap-5 lg:grid-cols-5">
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <MailIcon className="h-4.5 w-4.5" />
                  </span>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Nuova richiesta
                  </h2>
                </div>

                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  Descrivi la tua richiesta con il maggior dettaglio possibile.
                  La segreteria la riceverà e potrà aggiornarne lo stato.
                </p>

                <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      htmlFor={messageFieldId}
                    >
                      Messaggio
                    </label>
                    <textarea
                      className={`${inputClass} min-h-36 resize-y`}
                      disabled={isSubmitting}
                      id={messageFieldId}
                      maxLength={MAX_MESSAGE_LENGTH}
                      name="message"
                      onChange={(changeEvent) => {
                        setMessage(changeEvent.target.value);
                        setFormError(null);
                      }}
                      placeholder="Es. Vorrei informazioni sulle prossime attività del gruppo…"
                      required
                      rows={6}
                      value={message}
                    />
                    <p className="mt-1.5 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      {message.length}/{MAX_MESSAGE_LENGTH}
                    </p>
                  </div>

                  {formError ? (
                    <div
                      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                      role="alert"
                    >
                      <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  ) : null}

                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    disabled={isSubmitting || !message.trim()}
                    type="submit"
                  >
                    {isSubmitting ? (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      />
                    ) : (
                      <MailIcon className="h-4 w-4" />
                    )}
                    {isSubmitting ? "Invio…" : "Invia richiesta"}
                  </button>
                </form>
              </section>

              <section
                className="scroll-mt-24 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3 dark:border-zinc-800 dark:bg-zinc-900"
                ref={mySectionRef}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Le tue richieste
                  </h2>
                  <div className="flex items-center gap-2">
                    {isMyRefreshing ? (
                      <span
                        aria-label="Aggiornamento delle richieste"
                        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
                        role="status"
                      />
                    ) : null}
                    <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                      {myTotal}{" "}
                      {myTotal === 1 ? "richiesta" : "richieste"}
                    </p>
                  </div>
                </div>

                {myRequests.length > 0 ? (
                  <>
                    <ul className="mt-4 space-y-3">
                      {myRequests.map((request) => (
                        <li
                          className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                          key={request.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <RequestStatusBadge status={request.status} />
                            <time
                              className="text-xs text-zinc-500 dark:text-zinc-400"
                              dateTime={request.created_at}
                            >
                              {formatRequestDate(request.created_at)}
                            </time>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                            {request.message}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <Pagination
                      className="mt-4"
                      disabled={isMyRefreshing}
                      itemLabel="richieste"
                      onPageChange={handleMyPageChange}
                      page={myPage}
                      pageCount={myPageCount}
                      pageSize={MY_PAGE_SIZE}
                      total={myTotal}
                    />
                  </>
                ) : (
                  <div
                    className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40"
                    role="status"
                  >
                    <MailIcon className="mx-auto h-9 w-9 text-zinc-400 dark:text-zinc-500" />
                    <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      Nessuna richiesta inviata
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      Quando invierai un messaggio alla segreteria, comparirà qui
                      con il suo stato.
                    </p>
                  </div>
                )}
              </section>
            </div>

            {isAdmin ? (
              <section
                className="mt-10 scroll-mt-24 border-t border-zinc-200 pt-8 dark:border-zinc-800"
                ref={boardSectionRef}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      Solo amministratori
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                      Bacheca della segreteria
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      Tutte le richieste inviate dai soci. Apri una richiesta,
                      leggila e aggiorna il suo stato quando è stata gestita.
                    </p>
                  </div>

                  <div
                    aria-label="Filtra le richieste per stato"
                    className="inline-flex w-full shrink-0 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm sm:w-auto dark:border-zinc-800 dark:bg-zinc-900"
                    role="group"
                  >
                    {STATUS_FILTERS.map((filter) => {
                      const isActive = statusFilter === filter.value;
                      const count =
                        filter.value === "all"
                          ? requestCounts.total
                          : filter.value === "open"
                            ? requestCounts.open
                            : requestCounts.resolved;

                      return (
                        <button
                          aria-pressed={isActive}
                          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
                            isActive
                              ? "bg-emerald-700 text-white dark:bg-emerald-600"
                              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                          }`}
                          key={filter.value}
                          onClick={() =>
                            handleStatusFilterChange(filter.value)
                          }
                          type="button"
                        >
                          {filter.label}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="sr-only" htmlFor="request-search">
                    Cerca nelle richieste per testo
                  </label>
                  <div className="relative w-full sm:max-w-sm">
                    <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                    <input
                      autoComplete="off"
                      className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:appearance-none"
                      id="request-search"
                      onChange={(event) =>
                        handleBoardSearchChange(event.target.value)
                      }
                      placeholder="Cerca nel testo delle richieste…"
                      type="search"
                      value={boardQuery}
                    />
                    {boardQuery ? (
                      <button
                        aria-label="Azzera la ricerca"
                        className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        onClick={() => handleBoardSearchChange("")}
                        type="button"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <p
                    aria-live="polite"
                    className="text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    {isBoardRefreshing ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
                        />
                        Aggiornamento della bacheca…
                      </span>
                    ) : isBoardFiltered ? (
                      `${boardTotal} ${
                        boardTotal === 1 ? "risultato" : "risultati"
                      }`
                    ) : null}
                  </p>
                </div>

                {requestCounts.error && !boardError ? (
                  <div
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    role="alert"
                  >
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Impossibile aggiornare i conteggi delle richieste.
                    </span>
                  </div>
                ) : null}

                {boardError ? (
                  <div
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    role="alert"
                  >
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{boardError}</span>
                  </div>
                ) : null}

                {membersError && boardMemberIds.length > 0 ? (
                  <div
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    role="alert"
                  >
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Impossibile caricare i nomi dei soci: {membersError} Le
                      richieste restano comunque consultabili.
                    </span>
                  </div>
                ) : null}

                {adminError ? (
                  <div
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    role="alert"
                  >
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{adminError}</span>
                  </div>
                ) : null}

                {isBoardLoading ? (
                  <div
                    aria-label="Caricamento della bacheca"
                    className="mt-5 space-y-3"
                    role="status"
                  >
                    {[0, 1].map((item) => (
                      <div
                        className="h-28 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
                        key={item}
                      />
                    ))}
                  </div>
                ) : boardRequests.length > 0 ? (
                  <>
                    <ul className="mt-5 space-y-3">
                      {boardRequests.map((request) => {
                        const memberName = request.user_id
                          ? memberNames.get(request.user_id) ?? "Socio"
                          : DELETED_MEMBER_NAME;
                        const isUpdating = updatingId === request.id;

                        return (
                          <li
                            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                            key={request.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  {getInitials(memberName)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                    {memberName}
                                  </p>
                                  <time
                                    className="text-xs text-zinc-500 dark:text-zinc-400"
                                    dateTime={request.created_at}
                                  >
                                    {formatRequestDate(request.created_at)}
                                  </time>
                                </div>
                              </div>
                              <RequestStatusBadge status={request.status} />
                            </div>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                              {request.message}
                            </p>

                            <div className="mt-4 flex justify-end">
                              <button
                                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                                  request.status === "open"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                }`}
                                disabled={isUpdating}
                                onClick={() =>
                                  handleStatusChange(
                                    request.id,
                                    request.status === "open"
                                      ? "resolved"
                                      : "open",
                                  )
                                }
                                type="button"
                              >
                                {isUpdating ? (
                                  <span
                                    aria-hidden="true"
                                    className={`h-4 w-4 animate-spin rounded-full border-2 ${
                                      request.status === "open"
                                        ? "border-emerald-700/30 border-t-emerald-700 dark:border-emerald-300/30 dark:border-t-emerald-300"
                                        : "border-zinc-400/50 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-300"
                                    }`}
                                  />
                                ) : request.status === "open" ? (
                                  <CheckCircleIcon className="h-4 w-4" />
                                ) : (
                                  <ClockIcon className="h-4 w-4" />
                                )}
                                {isUpdating
                                  ? "Aggiornamento…"
                                  : request.status === "open"
                                    ? "Segna come risolta"
                                    : "Riapri richiesta"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Pagination
                      className="mt-4"
                      disabled={isBoardRefreshing}
                      itemLabel="richieste"
                      onPageChange={handleBoardPageChange}
                      page={boardPage}
                      pageCount={boardPageCount}
                      pageSize={BOARD_PAGE_SIZE}
                      total={boardTotal}
                    />
                  </>
                ) : boardError ? null : (
                  <div
                    className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40"
                    role="status"
                  >
                    <CheckCircleIcon className="mx-auto h-9 w-9 text-zinc-400 dark:text-zinc-500" />
                    <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      {hasBoardSearch
                        ? "Nessuna richiesta trovata"
                        : isBoardFiltered
                          ? "Nessuna richiesta in questo filtro"
                          : "Nessuna richiesta ricevuta"}
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {hasBoardSearch
                        ? "Prova con un’altra parola del testo della richiesta."
                        : isBoardFiltered
                          ? "Prova a selezionare un altro stato."
                          : "Le richieste inviate dai soci compariranno qui."}
                    </p>
                    {isBoardFiltered ? (
                      <button
                        className="mt-5 inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        onClick={() => {
                          handleBoardSearchChange("");
                          handleStatusFilterChange("all");
                        }}
                        type="button"
                      >
                        Azzera filtri
                      </button>
                    ) : null}
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
