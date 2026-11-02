"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  downloadUserDataExport,
  fetchUserDataExport,
  type ExportFormat,
} from "@/lib/data-export";
import { getUserDisplayName } from "@/lib/display";
import { useAuth } from "./auth-provider";
import { AuthScreen } from "./auth-screen";
import { DeleteAccountDialog } from "./delete-account-dialog";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  LogOutIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "./icons";

/**
 * Holding screen for authenticated accounts that are not approved yet.
 *
 * `AuthGuard` renders this instead of the requested page, so a pending or
 * rejected member never sees member data even if they navigate directly to a
 * protected URL. The database enforces the same rule through restrictive RLS
 * policies; this screen is the human-readable side of that boundary.
 */
export function ApprovalGate() {
  const {
    user,
    approvalStatus,
    approvalError,
    retryApproval,
    signOut,
  } = useAuth();
  const router = useRouter();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null,
  );

  if (!user) return null;

  const userId = user.id;
  const displayName = getUserDisplayName(user);
  const isRejected = approvalStatus === "rejected";
  const isError = approvalStatus === "error";
  const isPending = !isRejected && !isError;
  const isBusy = isSigningOut;

  const title = isError
    ? "Verifica non riuscita"
    : isRejected
      ? "Richiesta non approvata"
      : "Account in attesa di approvazione";
  const description = isError
    ? "Non siamo riusciti a leggere lo stato del tuo account. Riprova tra poco."
    : isRejected
      ? "La richiesta di accesso non è stata approvata. Se pensi che sia un errore, contatta gli amministratori del gruppo."
      : "Il tuo account è stato creato correttamente. Ora serve l’approvazione di un amministratore per entrare nel portale.";

  async function handleSignOut() {
    if (isBusy) return;

    setActionError(null);
    setIsSigningOut(true);

    const { error } = await signOut();

    if (error) {
      setActionError(error);
      setIsSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  async function handleAccountDeleted() {
    setIsDeleteOpen(false);
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleExport(format: ExportFormat) {
    if (exportingFormat !== null) return;

    setExportError(null);
    setExportingFormat(format);

    const { data, error: exportRequestError } = await fetchUserDataExport(
      userId,
    );

    if (exportRequestError || !data) {
      setExportError(
        exportRequestError ??
          "Impossibile preparare l’esportazione. Riprova tra poco.",
      );
      setExportingFormat(null);
      return;
    }

    downloadUserDataExport(data, format, displayName);
    setExportingFormat(null);
  }

  return (
    <AuthScreen description={description} title={title}>
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              isRejected || isError
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            }`}
          >
            {isError || isRejected ? (
              <AlertCircleIcon className="h-5 w-5" />
            ) : (
              <ClockIcon className="h-5 w-5" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isError
                ? "Stato non disponibile"
                : isRejected
                  ? "Accesso non approvato"
                  : "Richiesta ricevuta"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {isError
                ? (approvalError ??
                  "Si è verificato un errore imprevisto. Riprova tra poco.")
                : isRejected
                  ? `L’account ${user.email ?? ""} non ha ricevuto l’approvazione. Puoi comunque eliminarlo definitivamente.`
                  : `La richiesta di ${displayName} è stata registrata. Un amministratore del Gruppo Alpini la verificherà prima di aprire l’accesso.`}
            </p>
          </div>
        </div>

        {isPending ? (
          <ul className="mt-5 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>
                La richiesta è collegata all’indirizzo{" "}
                <span className="font-semibold">{user.email}</span>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>
                Un amministratore deve approvarla. La decisione può richiedere
                qualche giorno.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>
                Fino all’approvazione non puoi consultare iscritti ed eventi,
                né inviare richieste alla segreteria.
              </span>
            </li>
          </ul>
        ) : null}

        {actionError ? (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            disabled={isBusy}
            onClick={retryApproval}
            type="button"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Controlla di nuovo
          </button>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={isBusy}
            onClick={handleSignOut}
            type="button"
          >
            {isSigningOut ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200"
              />
            ) : (
              <LogOutIcon className="h-4 w-4" />
            )}
            {isSigningOut ? "Uscita…" : "Esci"}
          </button>
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            I tuoi dati
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Puoi scaricare una copia dei dati collegati al tuo account anche
            prima dell’approvazione: scheda personale, email, risposte agli
            eventi, richieste e storico dei consensi privacy.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {(
              [
                { format: "json", label: "Scarica JSON" },
                { format: "text", label: "Scarica testo" },
                { format: "html", label: "Scarica HTML" },
              ] as const
            ).map((option, index) => (
              <button
                className={
                  index === 0
                    ? "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    : "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }
                disabled={isBusy || exportingFormat !== null}
                key={option.format}
                onClick={() => handleExport(option.format)}
                type="button"
              >
                {exportingFormat === option.format ? (
                  <span
                    aria-hidden="true"
                    className={
                      index === 0
                        ? "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        : "h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200"
                    }
                  />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
                {exportingFormat === option.format
                  ? "Preparazione…"
                  : option.label}
              </button>
            ))}
          </div>

          {exportError ? (
            <div
              className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Non vuoi più usare questo account?
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Puoi eliminare definitivamente l’account e la scheda personale anche
            prima dell’approvazione.
          </p>
          <button
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={isBusy}
            onClick={() => setIsDeleteOpen(true)}
            type="button"
          >
            <TrashIcon className="h-4 w-4" />
            Elimina il mio account
          </button>
        </div>
      </div>

      {isDeleteOpen ? (
        <DeleteAccountDialog
          displayName={displayName}
          mode="self"
          onClose={() => setIsDeleteOpen(false)}
          onDeleted={handleAccountDeleted}
          userId={userId}
        />
      ) : null}
    </AuthScreen>
  );
}
