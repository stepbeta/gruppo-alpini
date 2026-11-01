"use client";

import { useId, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { PasswordUpdateForm } from "@/components/password-update-form";
import {
  getCredentialsProvider,
  updateEmail,
} from "@/lib/auth-actions";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  GoogleIcon,
  MailIcon,
  ShieldCheckIcon,
} from "@/components/icons";

type SecurityCredentialsProps = {
  user: User;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const labelClass =
  "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export function SecurityCredentials({ user }: SecurityCredentialsProps) {
  const provider = getCredentialsProvider(user);
  const emailId = useId();

  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setEmailNotice(null);

    const cleanEmail = newEmail.trim();

    if (!cleanEmail) {
      setEmailError("Inserisci il nuovo indirizzo email.");
      return;
    }

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setEmailError("Inserisci un indirizzo email valido.");
      return;
    }

    if (user.email && cleanEmail.toLowerCase() === user.email.toLowerCase()) {
      setEmailError("Inserisci un indirizzo email diverso da quello attuale.");
      return;
    }

    setIsUpdatingEmail(true);

    const { error, pendingConfirmation } = await updateEmail(
      cleanEmail,
      window.location.origin,
    );

    if (error) {
      setEmailError(error);
      setIsUpdatingEmail(false);
      return;
    }

    setNewEmail("");
    setEmailNotice(
      pendingConfirmation
        ? "Ti abbiamo inviato un’email di conferma. Apri il link nella nuova casella per completare la modifica; se richiesto, conferma anche dalla casella attuale."
        : "Indirizzo email aggiornato con successo.",
    );
    setIsUpdatingEmail(false);
  }

  return (
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <ShieldCheckIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sicurezza e credenziali
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Gestisci la password e l’indirizzo email collegati al tuo account.
          </p>
        </div>
      </div>

      {provider === "google" ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <GoogleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
              Accesso tramite Google
            </p>
            <p className="mt-1 text-sm leading-6 text-sky-800 dark:text-sky-200">
              Il tuo account è collegato a Google. La gestione della password e
              della sicurezza avviene direttamente tramite il tuo account
              Google.
            </p>
          </div>
        </div>
      ) : provider === "external" ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" />
          <div>
            <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">
              Accesso tramite provider esterno
            </p>
            <p className="mt-1 text-sm leading-6 text-sky-800 dark:text-sky-200">
              La gestione della password e della sicurezza avviene tramite il
              provider con cui hai effettuato l’accesso.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Cambia password
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              La nuova password sarà valida dal prossimo accesso.
            </p>
            <div className="mt-4">
              <PasswordUpdateForm />
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Cambia email
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Email attuale:{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                {user.email ?? "non disponibile"}
              </span>
              . Ti invieremo un link di conferma prima di applicare la modifica.
            </p>

            <form className="mt-4 space-y-4" onSubmit={handleEmailSubmit}>
              <div>
                <label className={labelClass} htmlFor={emailId}>
                  Nuovo indirizzo email
                </label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <input
                    autoComplete="email"
                    className={inputClass}
                    disabled={isUpdatingEmail}
                    id={emailId}
                    name="new-email"
                    onChange={(event) => {
                      setNewEmail(event.target.value);
                      setEmailError(null);
                      setEmailNotice(null);
                    }}
                    placeholder="nuova@esempio.it"
                    required
                    type="email"
                    value={newEmail}
                  />
                </div>
              </div>

              {emailError ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  role="alert"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{emailError}</span>
                </div>
              ) : null}

              {emailNotice ? (
                <div
                  className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  role="status"
                >
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{emailNotice}</span>
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  disabled={isUpdatingEmail}
                  type="submit"
                >
                  {isUpdatingEmail ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                  ) : null}
                  {isUpdatingEmail ? "Invio…" : "Aggiorna email"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </section>
  );
}
