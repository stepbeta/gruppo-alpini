"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { AuthScreen } from "./auth-screen";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { getUserDisplayName } from "@/lib/display";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  LogOutIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "./icons";

/**
 * Blocking first-time consent screen.
 *
 * It is rendered by `AuthGuard` instead of the requested page, so refusing or
 * closing the tab never exposes the portal. Signing out and account deletion
 * are the only alternatives; the account stays restricted by RLS until a
 * consent row exists.
 */
export function PrivacyConsentGate() {
  const {
    user,
    consentStatus,
    consentError,
    acceptConsent,
    retryConsent,
    signOut,
  } = useAuth();
  const router = useRouter();
  const checkboxId = useId();

  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const hasCheckError = consentStatus === "error";
  const isBusy = isAccepting || isSigningOut;

  async function handleAccept() {
    if (!hasAcceptedTerms || isBusy) return;

    setActionError(null);
    setIsAccepting(true);

    const { error } = await acceptConsent();

    if (error) {
      setActionError(error);
      setIsAccepting(false);
      return;
    }

    setIsAccepting(false);
  }

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

  return (
    <AuthScreen
      description="Per usare il portale devi leggere e accettare l’informativa sul trattamento dei dati personali."
      title="Prima di entrare"
    >
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <ShieldCheckIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Consenso necessario
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Il portale conserva la tua scheda, le risposte agli eventi e le
              richieste inviate alla segreteria. Senza il consenso non possiamo
              mostrarti i dati dei soci né permetterti di usare queste funzioni.
            </p>
          </div>
        </div>

        {hasCheckError ? (
          <div
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Impossibile verificare il consenso privacy
                </p>
                <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-200">
                  {consentError ??
                    "Si è verificato un errore imprevisto. Riprova tra poco."}
                </p>
                <button
                  className="mt-3 inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                  onClick={retryConsent}
                  type="button"
                >
                  Riprova
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Cosa comporta il consenso
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    I tuoi dati sono usati solo per la vita del gruppo, gli
                    eventi e la lista dei soci.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    Puoi esportare o eliminare i tuoi dati in qualsiasi momento
                    dalla pagina Profilo.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    Su richiesta, gli amministratori possono eliminare o
                    anonimizzare il tuo account e i dati collegati.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-start gap-3">
                <input
                  checked={hasAcceptedTerms}
                  className="mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-zinc-300 accent-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950"
                  disabled={isBusy}
                  id={checkboxId}
                  onChange={(event) =>
                    setHasAcceptedTerms(event.target.checked)
                  }
                  type="checkbox"
                />
                <label
                  className="text-sm leading-6 text-zinc-800 dark:text-zinc-200"
                  htmlFor={checkboxId}
                >
                  Ho letto e accetto l’
                  <Link
                    className="font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200"
                    href={PRIVACY_POLICY_PATH}
                    onClick={(event) => event.stopPropagation()}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Informativa sulla privacy
                  </Link>{" "}
                  del Gruppo Alpini.
                </label>
              </div>
            </div>

            {actionError ? (
              <div
                className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                role="alert"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            ) : null}

            <button
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              disabled={!hasAcceptedTerms || isBusy}
              onClick={handleAccept}
              type="button"
            >
              {isAccepting ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              ) : (
                <ShieldCheckIcon className="h-4 w-4" />
              )}
              {isAccepting ? "Registrazione del consenso…" : "Accetta e continua"}
            </button>
          </>
        )}

        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Non vuoi accettare?
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Puoi uscire senza accedere al portale oppure eliminare
            definitivamente il tuo account. Finché non accetti, l’account resta
            bloccato e non può leggere i dati dei soci.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
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
              {isSigningOut ? "Uscita…" : "Esci senza accettare"}
            </button>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
              disabled={isBusy}
              onClick={() => setIsDeleteOpen(true)}
              type="button"
            >
              <TrashIcon className="h-4 w-4" />
              Elimina il mio account
            </button>
          </div>

          {hasCheckError && actionError ? (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          ) : null}
        </div>
      </div>

      {isDeleteOpen ? (
        <DeleteAccountDialog
          displayName={displayName}
          mode="self"
          onClose={() => setIsDeleteOpen(false)}
          onDeleted={handleAccountDeleted}
          userId={user.id}
        />
      ) : null}
    </AuthScreen>
  );
}
