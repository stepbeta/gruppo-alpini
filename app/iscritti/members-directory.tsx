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
 * In pratica: se cambi la ricerca, i filtri di stato o ruolo, la gestione
 * degli amministratori o i dati mostrati nella directory, aggiorna i
 * suggerimenti e gli stati vuoti nello stesso PR.
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Pagination } from "@/components/pagination";
import {
  EmptyStateCard,
  emptyStatePrimaryActionClass,
  emptyStateSecondaryActionClass,
} from "@/components/empty-state";
import { useAuth } from "@/components/auth-provider";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { getInitials } from "@/lib/display";
import { formatFriendlyError } from "@/lib/error-messages";
import {
  fetchMemberCount,
  fetchMembers,
  fetchProfile,
  getVisibleMemberFilters,
  type Member,
  type MembersFilter,
} from "@/lib/profile";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useHashScroll } from "@/lib/use-hash-scroll";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  MegaphoneIcon,
  PencilIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";
import { MemberEditDialog } from "./member-edit-dialog";

function formatBirthDate(value: string | null): string {
  if (!value) return "Non indicata";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "Non indicata";

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDirectoryError(message: string): string {
  return formatFriendlyError(message, {
    fallback:
      "Non è stato possibile caricare la lista iscritti. Riprova tra poco; se il problema continua, contatta un amministratore.",
    permission:
      "Il database non consente la lettura della lista. Verifica che le migrazioni Supabase siano state applicate.",
    missingTable:
      "La tabella dei profili non è ancora disponibile. Verifica le migrazioni Supabase.",
  });
}

const MEMBER_PAGE_SIZE = 8;

export function MembersDirectory() {
  const { user, signOut, isAdmin: isAuthAdmin } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const [filter, setFilter] = useState<MembersFilter>("all");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const didLoadRef = useRef(false);
  const listTopRef = useRef<HTMLDivElement>(null);

  const visibleFilters = getVisibleMemberFilters(isAuthAdmin);
  // A regular member must never request the pending queue. If the role changes
  // while the chip is selected, fall back to the full approved directory.
  const effectiveFilter: MembersFilter =
    isAuthAdmin || filter !== "pending" ? filter : "all";

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchProfile(userId).then(({ profile, error }) => {
      if (!isActive) return;

      if (error) {
        setProfileError(formatDirectoryError(error));
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
    if (!userId) return;

    let isActive = true;

    if (didLoadRef.current) {
      setIsRefreshing(true);
    }

    fetchMembers({
      page,
      pageSize: MEMBER_PAGE_SIZE,
      search: debouncedQuery,
      filter: effectiveFilter,
    }).then((result) => {
      if (!isActive) return;

      if (result.error) {
        setMembersError(formatDirectoryError(result.error));
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (page > Math.max(1, result.pageCount)) {
        setPage(Math.max(1, result.pageCount));
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      setMembers(result.members);
      setTotalResults(result.total);
      setPageCount(result.pageCount);
      setMembersError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      didLoadRef.current = true;
    });

    return () => {
      isActive = false;
    };
  }, [userId, page, debouncedQuery, effectiveFilter, reloadKey]);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchMemberCount().then(({ count }) => {
      if (!isActive) return;
      setTotalMembers(count);
    });

    return () => {
      isActive = false;
    };
  }, [userId, reloadKey]);

  const hasSearch = debouncedQuery.length > 0;
  const hasDirectory = totalMembers > 0 || totalResults > 0;
  const isFiltering = hasSearch || effectiveFilter !== "all";
  const hasResults = members.length > 0;
  const activeFilter =
    visibleFilters.find((item) => item.value === effectiveFilter) ??
    visibleFilters[0];
  const loadError = profileError ?? membersError;

  useHashScroll(!isLoading && !loadError && (hasDirectory || isFiltering));

  const rangeStart =
    totalResults === 0 ? 0 : (page - 1) * MEMBER_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * MEMBER_PAGE_SIZE, totalResults);

  const handleCloseEditor = useCallback(() => {
    setEditingMember(null);
  }, []);

  const handleMemberSaved = useCallback(
    (updatedMember: Member) => {
      const previousMember = editingMember;
      const displayName =
        updatedMember.full_name?.trim() || "questo iscritto";

      setEditingMember(null);
      setReloadKey((current) => current + 1);

      if (previousMember && previousMember.is_admin !== updatedMember.is_admin) {
        setNotice(
          updatedMember.is_admin
            ? `${displayName} è ora amministratore.`
            : `Il ruolo di amministratore di ${displayName} è stato revocato.`,
        );
        return;
      }

      if (
        previousMember &&
        previousMember.approval_status !== updatedMember.approval_status
      ) {
        if (updatedMember.approval_status === "approved") {
          setNotice(`L’account di ${displayName} è stato approvato.`);
        } else if (previousMember.approval_status === "approved") {
          setNotice(`L’accesso di ${displayName} è stato revocato.`);
        } else {
          setNotice(`La richiesta di ${displayName} è stata rifiutata.`);
        }
        return;
      }

      setNotice(`Scheda di ${displayName} aggiornata.`);
    },
    [editingMember],
  );

  const handleRequestDelete = useCallback((member: Member) => {
    setEditingMember(null);
    setDeletingMember(member);
    setNotice(null);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeletingMember(null);
  }, []);

  const handleMemberDeleted = useCallback(() => {
    if (!deletingMember) return;

    const deletedId = deletingMember.id;
    const deletedName =
      deletingMember.full_name?.trim() || "questo iscritto";

    setDeletingMember(null);
    setNotice(`Scheda di ${deletedName} eliminata.`);
    setReloadKey((current) => current + 1);

    // An administrator can delete their own account from the directory. The
    // auth user is already gone, so clear the local session and leave.
    if (deletedId === userId) {
      void signOut().then(() => {
        router.replace("/login");
        router.refresh();
      });
    }
  }, [deletingMember, userId, signOut, router]);

  function handleRetry() {
    setIsLoading(true);
    setProfileError(null);
    setMembersError(null);
    setReloadKey((current) => current + 1);
  }

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Il gruppo
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
              Lista iscritti
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-300">
              Tutti i soci registrati nel portale. Cerca per nome o per luogo
              di servizio.
            </p>
          </div>

          {!isLoading && !loadError ? (
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <Link
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
                  href="/avvisi"
                >
                  <MegaphoneIcon className="h-4 w-4" />
                  Gestisci avvisi
                </Link>
              ) : null}
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <UsersIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                {totalMembers}{" "}
                {totalMembers === 1 ? "iscritto" : "iscritti"}
              </p>
            </div>
          ) : null}
        </div>

        {!isLoading && !loadError && (hasDirectory || isFiltering) ? (
          <div
            className="mt-6 scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
            id="cerca-iscritti"
          >
            <label className="sr-only" htmlFor="member-search">
              Cerca iscritti per nome o luogo di servizio
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                aria-describedby="member-search-hint"
                autoComplete="off"
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-11 pr-11 text-base text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:appearance-none"
                id="member-search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cerca per nome o luogo di servizio…"
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Azzera la ricerca"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  type="button"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <p
              className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
              id="member-search-hint"
            >
              Cerca per nome, cognome o luogo di servizio. La ricerca non
              distingue maiuscole e minuscole e accetta anche parole parziali.
            </p>

            <div
              aria-label="Filtra gli iscritti"
              className="mt-3 flex flex-wrap gap-2"
              role="group"
            >
              {visibleFilters.map((item) => {
                const isSelected = effectiveFilter === item.value;

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                      isSelected
                        ? "border-emerald-700 bg-emerald-700 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600"
                        : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                    }`}
                    key={item.value}
                    onClick={() => {
                      setFilter(item.value);
                      setPage(1);
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {isAuthAdmin
                ? "Amministratori e Utenti distinguono i ruoli; In attesa mostra gli account che devono ancora essere approvati. I filtri si combinano con la ricerca e restano sul server."
                : "Amministratori e Utenti distinguono i ruoli. I filtri si combinano con la ricerca e restano sul server."}
            </p>

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
                    Aggiornamento della lista…
                  </span>
                ) : hasSearch ? (
                  effectiveFilter === "all"
                    ? `${totalResults} ${
                        totalResults === 1
                          ? "iscritto trovato"
                          : "iscritti trovati"
                      } su ${totalMembers}`
                    : `${totalResults} ${
                        totalResults === 1 ? "risultato" : "risultati"
                      } con il filtro ${activeFilter.label}`
                ) : effectiveFilter === "pending" ? (
                  `${totalResults} account in attesa`
                ) : effectiveFilter === "admins" ? (
                  `${totalResults} ${
                    totalResults === 1
                      ? "amministratore"
                      : "amministratori"
                  }`
                ) : effectiveFilter === "users" ? (
                  `${totalResults} ${
                    totalResults === 1 ? "utente" : "utenti"
                  }`
                ) : (
                  `Mostrando ${rangeStart}–${rangeEnd} di ${totalResults} ${
                    totalResults === 1 ? "iscritto" : "iscritti"
                  }`
                )}
              </p>
              {query || effectiveFilter !== "all" ? (
                <button
                  className="rounded text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                    setPage(1);
                  }}
                  type="button"
                >
                  Azzera filtri
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

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
            aria-label="Caricamento della lista iscritti"
            className="mt-6 space-y-3"
            role="status"
          >
            {[0, 1, 2].map((item) => (
              <div
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
                key={item}
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  <div className="w-full space-y-3">
                    <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40"
            role="alert"
          >
            <AlertCircleIcon className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" />
            <h2 className="mt-3 text-lg font-semibold text-red-900 dark:text-red-100">
              Impossibile caricare la lista
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

        {!isLoading && !loadError && !hasDirectory && !isFiltering ? (
          <EmptyStateCard
            actions={
              <Link className={emptyStatePrimaryActionClass} href="/profile">
                Completa il tuo profilo
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            }
            className="mt-6"
            description="La lista si popolerà man mano che i soci completano la registrazione e ricevono l’approvazione. Se la tua scheda non è ancora compilata, puoi iniziare da lì."
            hint="La directory mostra solo gli account approvati. Gli amministratori vedono anche le richieste in attesa e gli account rifiutati."
            icon={<UsersIcon className="h-6 w-6" />}
            title="Nessun iscritto registrato"
            tone="emerald"
          />
        ) : null}

        {!isLoading && !loadError && isFiltering && !hasResults ? (
          <EmptyStateCard
            actions={
              <button
                className={emptyStateSecondaryActionClass}
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  setPage(1);
                }}
                type="button"
              >
                {hasSearch ? "Azzera ricerca e filtri" : "Mostra tutti gli iscritti"}
              </button>
            }
            className="mt-6"
            description={
              hasSearch
                ? effectiveFilter === "all"
                  ? `Non ci sono risultati per “${query.trim()}”. Controlla l’ortografia o prova con un cognome, una parte del nome o il luogo di servizio.`
                  : `Non ci sono risultati per “${query.trim()}” con il filtro ${activeFilter.label}. Prova ad azzerare la ricerca o a scegliere Tutti.`
                : effectiveFilter === "pending"
                  ? "Tutte le richieste di registrazione sono state gestite. I nuovi account compariranno qui finché non vengono approvati o rifiutati."
                  : effectiveFilter === "admins"
                    ? "Nessun account corrisponde al filtro Amministratori. Puoi assegnare il ruolo dalla scheda di un socio approvato."
                    : "Nessun account corrisponde al filtro Utenti. Gli amministratori sono esclusi da questa vista."
            }
            hint={
              hasSearch
                ? "Suggerimento: la ricerca non distingue maiuscole e minuscole. Prova ad esempio con “Belluno” o con le prime lettere del cognome."
                : effectiveFilter === "pending"
                  ? "Gli iscritti già approvati restano visibili nella lista completa."
                  : "Usa Tutti per rivedere l’intera directory."
            }
            icon={<SearchIcon className="h-6 w-6" />}
            title={
              hasSearch
                ? "Nessun iscritto trovato"
                : effectiveFilter === "pending"
                  ? "Nessun account in attesa"
                  : effectiveFilter === "admins"
                    ? "Nessun amministratore"
                    : "Nessun utente"
            }
            tone={hasSearch ? "neutral" : "emerald"}
          />
        ) : null}

        {!isLoading && !loadError && hasResults ? (
          <div className="scroll-mt-24" ref={listTopRef}>
            <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {members.map((member) => {
              const displayName = member.full_name?.trim() || "Nome non indicato";
              const isCurrentUser = member.id === userId;
              const avatarName = member.full_name?.trim() || "Socio";

              return (
                <li className="p-5 sm:p-6" key={member.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 sm:h-12 sm:w-12 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {getInitials(avatarName)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-lg font-semibold text-zinc-900 sm:text-xl dark:text-zinc-50">
                            {displayName}
                          </h2>
                          {isCurrentUser ? (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                              Tu
                            </span>
                          ) : null}
                          {member.is_admin ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              <ShieldCheckIcon className="h-3.5 w-3.5" />
                              Amministratore
                            </span>
                          ) : null}
                          {isAdmin && member.approval_status === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              <ClockIcon className="h-3.5 w-3.5" />
                              In attesa
                            </span>
                          ) : null}
                          {isAdmin && member.approval_status === "rejected" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                              <AlertCircleIcon className="h-3.5 w-3.5" />
                              Rifiutato
                            </span>
                          ) : null}
                        </div>

                        <dl className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-x-6">
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              Data di nascita
                            </dt>
                            <dd className="mt-0.5 text-base font-medium text-zinc-800 dark:text-zinc-200">
                              {formatBirthDate(member.birth_date)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              Anno di leva
                            </dt>
                            <dd className="mt-0.5 text-base font-medium text-zinc-800 dark:text-zinc-200">
                              {member.enlistment_year ?? "Non indicato"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              Luogo di servizio
                            </dt>
                            <dd className="mt-0.5 break-words text-base font-medium text-zinc-800 dark:text-zinc-200">
                              {member.service_place?.trim() || "Non indicato"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    {isAdmin ? (
                      <button
                        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                        onClick={() => {
                          setNotice(null);
                          setEditingMember(member);
                        }}
                        type="button"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Modifica
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
            </ul>
            <Pagination
              className="mt-4"
              disabled={isRefreshing}
              itemLabel="iscritti"
              onPageChange={handlePageChange}
              page={page}
              pageCount={pageCount}
              pageSize={MEMBER_PAGE_SIZE}
              total={totalResults}
            />
          </div>
        ) : null}
      </main>

      <SiteFooter />

      {editingMember ? (
        <MemberEditDialog
          key={editingMember.id}
          currentUserId={userId ?? null}
          member={editingMember}
          onClose={handleCloseEditor}
          onDelete={() => handleRequestDelete(editingMember)}
          onSaved={handleMemberSaved}
        />
      ) : null}

      {deletingMember ? (
        <DeleteAccountDialog
          displayName={deletingMember.full_name?.trim() || "questo socio"}
          mode={deletingMember.id === userId ? "self" : "admin"}
          onClose={handleCloseDelete}
          onDeleted={handleMemberDeleted}
          userId={deletingMember.id}
        />
      ) : null}
    </div>
  );
}
