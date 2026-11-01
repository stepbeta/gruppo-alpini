"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthScreen } from "@/components/auth-screen";
import { ConfigurationNotice } from "@/components/configuration-notice";
import { LoadingScreen } from "@/components/loading-screen";
import { PasswordUpdateForm } from "@/components/password-update-form";
import { useAuth } from "@/components/auth-provider";
import {
  getAuthRedirectErrorMessage,
  getCredentialsProvider,
  RECOVERY_LINK_ERROR,
} from "@/lib/auth-actions";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  GoogleIcon,
  ShieldCheckIcon,
} from "@/components/icons";

export default function ResetPasswordPage() {
  const { user, isLoading: isAuthLoading, isConfigured } = useAuth();

  const [redirectError] = useState<string | null>(() =>
    getAuthRedirectErrorMessage(),
  );
  const [isUpdated, setIsUpdated] = useState(false);

  if (!isConfigured) {
    return <ConfigurationNotice />;
  }

  if (isAuthLoading) {
    return <LoadingScreen message="Verifica del link…" />;
  }

  if (isUpdated) {
    return (
      <AuthScreen
        description="La nuova password è attiva e può essere usata dal prossimo accesso."
        title="Password aggiornata"
      >
        <div className="mt-8 rounded-3xl border border-emerald-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-emerald-900 dark:bg-zinc-900 dark:shadow-black/20">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            <p className="text-sm leading-6 text-emerald-800 dark:text-emerald-200">
              La password del tuo account è stata aggiornata con successo.
            </p>
          </div>

          <Link
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            href="/"
          >
            Vai al portale
          </Link>
        </div>
      </AuthScreen>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        description="Il link che hai aperto non è più utilizzabile. Puoi richiederne uno nuovo in pochi secondi."
        title="Link non valido"
      >
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
          <div
            className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{redirectError ?? RECOVERY_LINK_ERROR}</span>
          </div>

          <Link
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            href="/login/forgot"
          >
            Richiedi un nuovo link
          </Link>

          <p className="mt-4 text-center text-sm">
            <Link
              className="rounded font-medium text-emerald-700 hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
              href="/login"
            >
              Torna al login
            </Link>
          </p>
        </div>
      </AuthScreen>
    );
  }

  const provider = getCredentialsProvider(user);

  if (provider === "google" || provider === "external") {
    const isGoogle = provider === "google";

    return (
      <AuthScreen
        description="Questo account usa un provider esterno per l’accesso."
        title="Password gestita dal provider"
      >
        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
            {isGoogle ? (
              <GoogleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
            )}
            <div>
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                {isGoogle ? "Accesso tramite Google" : "Provider esterno"}
              </p>
              <p className="mt-1 text-sm leading-6 text-sky-800 dark:text-sky-200">
                {isGoogle
                  ? "Il tuo account è collegato a Google. La gestione della password e della sicurezza avviene direttamente tramite il tuo account Google."
                  : "La gestione della password e della sicurezza avviene tramite il provider con cui hai effettuato l’accesso."}
              </p>
            </div>
          </div>

          <Link
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            href="/profile"
          >
            Apri il profilo
          </Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      description={
        user.email
          ? `Inserisci una nuova password per ${user.email}.`
          : "Inserisci una nuova password per il tuo account."
      }
      title="Scegli una nuova password"
    >
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
        <PasswordUpdateForm
          autoFocus
          onSuccess={() => setIsUpdated(true)}
          submitLabel="Salva nuova password"
        />

        <p className="mt-5 border-t border-zinc-200 pt-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Dopo il salvataggio potrai usare la nuova password per accedere al
          portale.
        </p>
      </div>
    </AuthScreen>
  );
}
