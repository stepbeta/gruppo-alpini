"use client";

/**
 * ============================================================================
 * AVVISI — REGOLA DI MANUTENZIONE
 * ============================================================================
 *
 * Whenever announcement listing views, filters, lifecycle states, or
 * management structures are modified in the application, this file and any
 * related UI components must be updated simultaneously in the same pull
 * request to keep code and behavior aligned.
 *
 * In pratica: se cambi l’elenco degli avvisi, i filtri, gli stati del ciclo di
 * vita o la struttura di gestione, aggiorna questo file, i componenti UI
 * collegati e la documentazione nello stesso pull request.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { fetchProfile, formatProfileError } from "@/lib/profile";
import {
  ANNOUNCEMENT_STATE_LABELS,
  fetchAnnouncements,
  formatAnnouncementDate,
  formatAnnouncementError,
  getAnnouncementState,
  getAnnouncementWindowState,
  isAnnouncementVisible,
  matchesAnnouncementFilter,
  setAnnouncementActive,
  type Announcement,
  type AnnouncementFilter,
  type AnnouncementState,
} from "@/lib/announcements";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  MegaphoneIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@/components/icons";
import { AnnouncementDialog } from "./announcement-dialog";
import { DeleteAnnouncementDialog } from "./delete-announcement-dialog";

const STATE_STYLES: Record<AnnouncementState, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  scheduled:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  expired:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  inactive:
    "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

const ANNOUNCEMENT_FILTERS: ReadonlyArray<{
  value: AnnouncementFilter;
  label: string;
}> = [
  { value: "all", label: "Tutti" },
  { value: "active", label: "Attivi" },
  { value: "past", label: "Passati" },
];

type AnnouncementCardProps = {
  announcement: Announcement;
  isDisplayed: boolean;
  isToggling: boolean;
  now: number;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
};

function AnnouncementCard({
  announcement,
  isDisplayed,
  isToggling,
  now,
  onEdit,
  onToggle,
  onDelete,
}: AnnouncementCardProps) {
  const state = getAnnouncementState(announcement, now);
  const windowState = getAnnouncementWindowState(announcement, now);
  const windowHint =
    windowState === "expired"
      ? announcement.is_active
        ? "L’avviso è ancora attivo, ma la finestra è conclusa: aggiorna la data di fine per ripubblicarlo."
        : "La finestra è conclusa: aggiorna la data di fine prima di riattivarlo."
      : null;

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-zinc-900 ${
        isDisplayed
          ? "border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-800 dark:ring-emerald-900"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATE_STYLES[state]}`}
            >
              {ANNOUNCEMENT_STATE_LABELS[state]}
            </span>
            {isDisplayed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Mostrato ora
              </span>
            ) : null}
          </div>

          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {announcement.message}
          </p>

          <dl className="mt-4 grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                Creato il
              </dt>
              <dd className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {formatAnnouncementDate(announcement.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                Inizio
              </dt>
              <dd className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {announcement.start_date
                  ? formatAnnouncementDate(announcement.start_date)
                  : "Nessun limite"}
              </dd>
            </div>
            <div>
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                Fine
              </dt>
              <dd className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {announcement.end_date
                  ? formatAnnouncementDate(announcement.end_date)
                  : "Nessun limite"}
              </dd>
            </div>
          </dl>

          {windowHint ? (
            <p className="mt-2.5 text-xs leading-5 text-amber-700 dark:text-amber-300">
              {windowHint}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={onEdit}
            type="button"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Modifica
          </button>

          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            disabled={isToggling}
            onClick={onToggle}
            type="button"
          >
            {isToggling ? (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700 dark:border-emerald-800 dark:border-t-emerald-300"
              />
            ) : announcement.is_active ? (
              <EyeOffIcon className="h-3.5 w-3.5" />
            ) : (
              <EyeIcon className="h-3.5 w-3.5" />
            )}
            {announcement.is_active ? "Disattiva" : "Attiva"}
          </button>

          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
            onClick={onDelete}
            type="button"
          >
            <TrashIcon className="h-3.5 w-3.5" />
            Elimina
          </button>
        </div>
      </div>
    </article>
  );
}

export function AnnouncementsAdmin() {
  const { user } = useAuth();
  const userId = user?.id;

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<AnnouncementFilter>("all");
  const [now, setNow] = useState(0);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] =
    useState<Announcement | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const currentUserId = userId;
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      const profileResult = await fetchProfile(currentUserId);
      if (!isActive) return;

      if (profileResult.error) {
        setLoadError(formatProfileError(profileResult.error));
        setIsLoading(false);
        return;
      }

      if (profileResult.profile?.is_admin !== true) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const announcementResult = await fetchAnnouncements();
      if (!isActive) return;

      if (announcementResult.error) {
        setLoadError(formatAnnouncementError(announcementResult.error));
        setIsLoading(false);
        return;
      }

      setAnnouncements(announcementResult.announcements);
      setIsAdmin(true);
      setIsLoading(false);
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [userId, reloadKey]);

  // Lifecycle changes happen with the clock: a scheduled banner becomes active
  // and an active one expires without a page reload. Refresh the classification
  // every minute so filters and badges stay truthful.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timeout = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const referenceNow = now;

  const displayedAnnouncement =
    announcements.find((announcement) =>
      isAnnouncementVisible(announcement, referenceNow),
    ) ?? null;
  const displayedId = displayedAnnouncement?.id ?? null;

  const filterCounts = useMemo(() => {
    const counts: Record<AnnouncementFilter, number> = {
      all: announcements.length,
      active: 0,
      past: 0,
    };

    for (const announcement of announcements) {
      if (matchesAnnouncementFilter(announcement, "active", referenceNow)) {
        counts.active += 1;
      }
      if (matchesAnnouncementFilter(announcement, "past", referenceNow)) {
        counts.past += 1;
      }
    }

    return counts;
  }, [announcements, referenceNow]);

  const filteredAnnouncements = useMemo(
    () =>
      announcements.filter((announcement) =>
        matchesAnnouncementFilter(announcement, filter, referenceNow),
      ),
    [announcements, filter, referenceNow],
  );

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingAnnouncement(null);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeletingAnnouncement(null);
  }, []);

  function handleCreated(created: Announcement) {
    setAnnouncements((current) => [created, ...current]);
    setFilter("all");
    setIsCreateOpen(false);
    setNotice("Avviso creato.");
  }

  function handleUpdated(updated: Announcement) {
    setAnnouncements((current) =>
      current.map((announcement) =>
        announcement.id === updated.id ? updated : announcement,
      ),
    );
    setEditingAnnouncement(null);
    setNotice("Avviso aggiornato.");
  }

  function handleDeleted(announcementId: string) {
    setAnnouncements((current) =>
      current.filter((announcement) => announcement.id !== announcementId),
    );
    setDeletingAnnouncement(null);
    setNotice("Avviso eliminato.");
  }

  async function handleToggle(announcement: Announcement) {
    setActionError(null);
    setNotice(null);
    setTogglingId(announcement.id);

    const result = await setAnnouncementActive(
      announcement.id,
      !announcement.is_active,
    );
    const updated = result.announcement;

    if (result.error || !updated) {
      setActionError(
        formatAnnouncementError(
          result.error ?? "Impossibile aggiornare l’avviso. Riprova.",
        ),
      );
      setTogglingId(null);
      return;
    }

    setAnnouncements((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setTogglingId(null);
    setNotice(updated.is_active ? "Avviso attivato." : "Avviso disattivato.");
  }

  function handleRetry() {
    setReloadKey((current) => current + 1);
  }

  function handleOpenCreate() {
    setNotice(null);
    setActionError(null);
    setIsCreateOpen(true);
  }

  function handleOpenEdit(announcement: Announcement) {
    setNotice(null);
    setActionError(null);
    setEditingAnnouncement(announcement);
  }

  function handleOpenDelete(announcement: Announcement) {
    setNotice(null);
    setActionError(null);
    setDeletingAnnouncement(announcement);
  }

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Amministrazione
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
              Avvisi del portale
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-300">
              Pubblica un messaggio in cima a tutte le pagine del portale.
              Gestisci testo, finestra di pubblicazione e stato.
            </p>
          </div>

          {isAdmin ? (
            <button
              className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={handleOpenCreate}
              type="button"
            >
              <PlusIcon className="h-4 w-4" />
              Nuovo avviso
            </button>
          ) : null}
        </div>

        {notice ? (
          <div
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            role="status"
          >
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        {actionError ? (
          <div
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
            />
            <span role="status">Caricamento avvisi…</span>
          </div>
        ) : loadError ? (
          <div
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" />
              <div>
                <p className="text-base font-semibold text-red-900 dark:text-red-100">
                  Impossibile caricare gli avvisi
                </p>
                <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-200">
                  {loadError}
                </p>
                <button
                  className="mt-3 inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                  onClick={handleRetry}
                  type="button"
                >
                  Riprova
                </button>
              </div>
            </div>
          </div>
        ) : isAdmin === false ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <ShieldCheckIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Accesso riservato
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  Solo gli amministratori del gruppo possono gestire gli avvisi
                  del portale.
                </p>
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                  href="/"
                >
                  Torna alla pagina iniziale
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                  aria-label="Filtra gli avvisi"
                  className="flex flex-wrap gap-2"
                  role="group"
                >
                  {ANNOUNCEMENT_FILTERS.map((item) => {
                    const isSelected = filter === item.value;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                          isSelected
                            ? "border-emerald-700 bg-emerald-700 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600"
                            : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                        }`}
                        key={item.value}
                        onClick={() => setFilter(item.value)}
                        type="button"
                      >
                        {item.label}
                        <span
                          className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {filterCounts[item.value]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p
                  aria-live="polite"
                  className="text-sm text-zinc-500 dark:text-zinc-400"
                >
                  {filteredAnnouncements.length}{" "}
                  {filteredAnnouncements.length === 1
                    ? "avviso in questa vista"
                    : "avvisi in questa vista"}
                </p>
              </div>

              <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Attivi mostra solo gli avvisi visibili in questo momento.
                Passati raccoglie quelli con la finestra di pubblicazione
                conclusa; gli avvisi in programma o disattivati restano in
                Tutti.
              </p>
            </div>

            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <MegaphoneIcon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
                    Un solo avviso alla volta
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-200">
                    Il portale mostra il banner attivo più recente che rientra
                    nella finestra temporale. Un avviso senza date resta visibile
                    finché non lo disattivi o elimini.
                  </p>
                </div>
              </div>
            </section>

            {announcements.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <MegaphoneIcon className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Nessun avviso
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Crea il primo avviso per informare i soci di un evento, di una
                  scadenza o di una comunicazione importante.
                </p>
                <button
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  onClick={handleOpenCreate}
                  type="button"
                >
                  <PlusIcon className="h-4 w-4" />
                  Nuovo avviso
                </button>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <MegaphoneIcon className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {filter === "active"
                    ? "Nessun avviso attivo"
                    : "Nessun avviso passato"}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {filter === "active"
                    ? "In questo momento nessun avviso è attivo e dentro la finestra di pubblicazione. Apri Tutti per vedere quelli in programma o disattivati."
                    : "Nessun avviso ha una finestra di pubblicazione già conclusa. Apri Tutti per vedere quelli attivi, in programma o disattivati."}
                </p>
                <button
                  className="mt-5 inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                  onClick={() => setFilter("all")}
                  type="button"
                >
                  Mostra tutti gli avvisi
                </button>
              </div>
            ) : (
              <section
                aria-label="Elenco degli avvisi"
                className="mt-4 space-y-4"
              >
                {filteredAnnouncements.map((announcement) => (
                  <AnnouncementCard
                    announcement={announcement}
                    isDisplayed={announcement.id === displayedId}
                    isToggling={togglingId === announcement.id}
                    key={announcement.id}
                    now={referenceNow}
                    onDelete={() => handleOpenDelete(announcement)}
                    onEdit={() => handleOpenEdit(announcement)}
                    onToggle={() => handleToggle(announcement)}
                  />
                ))}
              </section>
            )}

            <p className="mt-5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Gli avvisi disattivati, in programma o scaduti restano disponibili
              nel filtro Tutti e non sono visibili ai soci. Un avviso con la
              finestra conclusa deve essere modificato prima di poter essere
              ripubblicato.
            </p>
          </>
        )}
      </main>

      <SiteFooter />

      {isCreateOpen ? (
        <AnnouncementDialog
          mode="create"
          onClose={handleCloseCreate}
          onSaved={handleCreated}
        />
      ) : null}

      {editingAnnouncement ? (
        <AnnouncementDialog
          announcement={editingAnnouncement}
          mode="edit"
          onClose={handleCloseEdit}
          onSaved={handleUpdated}
        />
      ) : null}

      {deletingAnnouncement ? (
        <DeleteAnnouncementDialog
          announcement={deletingAnnouncement}
          onClose={handleCloseDelete}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
