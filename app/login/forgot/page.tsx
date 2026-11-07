"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { ConfigurationNotice } from "@/components/configuration-notice";
import { LoadingScreen } from "@/components/loading-screen";
import { useAuth } from "@/components/auth-provider";
import { requestPasswordReset, isValidEmail } from "@/lib/auth-actions";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  GoogleIcon,
  MailIcon,
} from "@/components/icons";

export default function ForgotPasswordPage() {
  const { user, isLoading: isAuthLoading, isConfigured } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace("/profile");
    }
  }, [isAuthLoading, user, router]);

  if (!isConfigured) {
    return <ConfigurationNotice />;
  }

  if (isAuthLoading || user) {
    return <LoadingScreen message="Reindirizzamento…" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim();

    setError(null);
    setNotice(null);

    if (!cleanEmail) {
      setError("Inserisci il tuo indirizzo email.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Inserisci un indirizzo email valido, ad esempio nome@esempio.it.");
      return;
    }

    setIsSubmitting(true);

    const { error: resetError } = await requestPasswordReset(
      cleanEmail,
      `${window.location.origin}/login/reset-password`,
    );

    if (resetError) {
      setError(resetError);
      setIsSubmitting(false);
      return;
    }

    setNotice(
      "Se l’indirizzo è registrato, riceverai un’email con le istruzioni per reimpostare la password. Controlla anche la cartella spam.",
    );
    setIsSubmitting(false);
  }

  return (
    <AuthScreen
      description="Inserisci l’indirizzo email del tuo account: ti invieremo un link per scegliere una nuova password."
      title="Recupera la password"
    >
      <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative">
              <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                disabled={isSubmitting}
                id="email"
                name="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                  setNotice(null);
                }}
                placeholder="nome@esempio.it"
                required
                type="email"
                value={email}
              />
            </div>
          </div>

          {error ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              role="alert"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              role="status"
            >
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          ) : null}

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : null}
            {isSubmitting ? "Invio in corso…" : "Invia link di recupero"}
          </button>
        </form>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <GoogleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-6 text-sky-800 dark:text-sky-200">
            Se accedi con Google, la password viene gestita dal tuo account
            Google e non serve reimpostarla da qui.
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          className="inline-flex items-center gap-1.5 rounded font-semibold text-emerald-700 hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
          href="/login"
        >
          <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
          Torna al login
        </Link>
      </p>
    </AuthScreen>
  );
}
