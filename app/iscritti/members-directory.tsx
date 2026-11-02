"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { getInitials } from "@/lib/display";
import { fetchMembers, type Member } from "@/lib/profile";
import {
  AlertCircleIcon,
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

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501")
  ) {
    return "Il database non consente la lettura della lista. Verifica che le migrazioni Supabase siano state applicate.";
  }
  if (normalized.includes("does not exist")) {
    return "La tabella dei profili non è ancora disponibile. Verifica le migrazioni Supabase.";
  }

  return message;
}

export function MembersDirectory() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchMembers().then(({ members: nextMembers, error }) => {
      if (!isActive) return;

      if (error) {
        setLoadError(formatDirectoryError(error));
        setIsLoading(false);
        return;
      }

      setMembers(nextMembers);
      setLoadError(null);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [userId, reloadKey]);

  const isAdmin = members.some(
    (member) => member.id === userId && member.is_admin,
  );

  const sortedMembers = useMemo(() => {
    const collator = new Intl.Collator("it", { sensitivity: "base" });
    return [...members].sort((first, second) =>
      collator.compare(first.full_name ?? "", second.full_name ?? ""),
    );
  }, [members]);

  const filteredMembers = useMemo(() => {
    const term = normalizeSearch(deferredQuery);

    return sortedMembers.filter((member) => {
      if (showPendingOnly && member.approval_status !== "pending") {
        return false;
      }

      if (!term) return true;

      const name = normalizeSearch(member.full_name ?? "");
      const place = normalizeSearch(member.service_place ?? "");
      return name.includes(term) || place.includes(term);
    });
  }, [sortedMembers, deferredQuery, showPendingOnly]);

  const pendingCount = useMemo(
    () =>
      members.filter((member) => member.approval_status === "pending").length,
    [members],
  );

  const hasSearch = deferredQuery.trim().length > 0;
  const hasMembers = members.length > 0;

  const handleCloseEditor = useCallback(() => {
    setEditingMember(null);
  }, []);

  const handleMemberSaved = useCallback(
    (updatedMember: Member) => {
      const previousMember = members.find(
        (member) => member.id === updatedMember.id,
      );
      const displayName =
        updatedMember.full_name?.trim() || "questo iscritto";

      setMembers((current) =>
        current.map((member) =>
          member.id === updatedMember.id ? updatedMember : member,
        ),
      );
      setEditingMember(null);

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
    [members],
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

    setMembers((current) =>
      current.filter((member) => member.id !== deletedId),
    );
    setDeletingMember(null);
    setNotice(`Scheda di ${deletedName} eliminata.`);

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
    setLoadError(null);
    setReloadKey((current) => current + 1);
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
              {isAdmin && pendingCount > 0 ? (
                <button
                  aria-pressed={showPendingOnly}
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                    showPendingOnly
                      ? "border-amber-500 bg-amber-500 text-amber-950 dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950"
                      : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
                  }`}
                  onClick={() => setShowPendingOnly((current) => !current)}
                  type="button"
                >
                  <ClockIcon className="h-4 w-4" />
                  {pendingCount}{" "}
                  {pendingCount === 1
                    ? "richiesta in attesa"
                    : "richieste in attesa"}
                </button>
              ) : null}
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <UsersIcon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                {members.length}{" "}
                {members.length === 1 ? "iscritto" : "iscritti"}
              </p>
            </div>
          ) : null}
        </div>

        {!isLoading && !loadError && hasMembers ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="sr-only" htmlFor="member-search">
              Cerca iscritti per nome o luogo di servizio
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                autoComplete="off"
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-11 pr-11 text-base text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:appearance-none"
                id="member-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca per nome o luogo di servizio…"
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Azzera la ricerca"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p
                aria-live="polite"
                className="text-sm text-zinc-500 dark:text-zinc-400"
              >
                {showPendingOnly
                  ? `${filteredMembers.length} account in attesa`
                  : hasSearch
                    ? `${filteredMembers.length} ${
                        filteredMembers.length === 1
                          ? "iscritto trovato"
                          : "iscritti trovati"
                      } su ${members.length}`
                    : "Digita un nome o un luogo per filtrare la lista."}
              </p>
              {query || showPendingOnly ? (
                <button
                  className="rounded text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                  onClick={() => {
                    setQuery("");
                    setShowPendingOnly(false);
                  }}
                  type="button"
                >
                  {showPendingOnly ? "Mostra tutti" : "Azzera ricerca"}
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

        {!isLoading && !loadError && !hasMembers ? (
          <div
            className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            role="status"
          >
            <UsersIcon className="mx-auto h-9 w-9 text-zinc-400 dark:text-zinc-500" />
            <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Nessun iscritto registrato
            </h2>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Le schede dei soci compariranno qui man mano che vengono create.
            </p>
          </div>
        ) : null}

        {!isLoading && !loadError && hasMembers && filteredMembers.length === 0 ? (
          <div
            className="mt-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            role="status"
          >
            <SearchIcon className="mx-auto h-9 w-9 text-zinc-400 dark:text-zinc-500" />
            <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {showPendingOnly && !hasSearch
                ? "Nessun account in attesa"
                : "Nessun iscritto trovato"}
            </h2>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {showPendingOnly && !hasSearch
                ? "Tutte le richieste di registrazione sono state gestite."
                : `Non ci sono risultati per “${query.trim()}”. Prova con un altro nome o un altro luogo di servizio.`}
            </p>
            <button
              className="mt-5 inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              onClick={() => {
                setQuery("");
                setShowPendingOnly(false);
              }}
              type="button"
            >
              {showPendingOnly && !hasSearch
                ? "Mostra tutti gli iscritti"
                : "Azzera ricerca"}
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && filteredMembers.length > 0 ? (
          <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {filteredMembers.map((member) => {
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
