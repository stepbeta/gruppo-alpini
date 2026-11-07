"use client";

import { useId, useState, type FormEvent } from "react";
import { updatePassword } from "@/lib/auth-actions";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
} from "@/components/icons";

type PasswordUpdateFormProps = {
  submitLabel?: string;
  successMessage?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const labelClass =
  "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

/**
 * Shared password form used both by the recovery page and the profile security
 * section. Validation and Supabase error mapping live in `lib/auth-actions.ts`.
 */
export function PasswordUpdateForm({
  submitLabel = "Aggiorna password",
  successMessage = "Password aggiornata con successo.",
  onSuccess,
  autoFocus = false,
}: PasswordUpdateFormProps) {
  const passwordId = useId();
  const confirmationId = useId();
  const hintId = useId();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError("La password deve contenere almeno 6 caratteri.");
      return;
    }

    if (password !== confirmation) {
      setError("Le password non coincidono.");
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setError(updateError);
      setIsSubmitting(false);
      return;
    }

    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setIsSubmitting(false);
    setNotice(successMessage);
    onSuccess?.();
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label className={labelClass} htmlFor={passwordId}>
          Nuova password
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            aria-describedby={hintId}
            autoComplete="new-password"
            autoFocus={autoFocus}
            className={`${inputClass} pr-11`}
            disabled={isSubmitting}
            id={passwordId}
            minLength={6}
            name="new-password"
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
              setNotice(null);
            }}
            placeholder="Almeno 6 caratteri"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={
              showPassword
                ? "Nascondi nuova password"
                : "Mostra nuova password"
            }
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            disabled={isSubmitting}
            onClick={() => setShowPassword((visible) => !visible)}
            type="button"
          >
            {showPassword ? (
              <EyeOffIcon className="h-4.5 w-4.5" />
            ) : (
              <EyeIcon className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
        <p
          className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"
          id={hintId}
        >
          Almeno 6 caratteri. Scegli una password che non usi altrove.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor={confirmationId}>
          Conferma nuova password
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            autoComplete="new-password"
            className={inputClass}
            disabled={isSubmitting}
            id={confirmationId}
            minLength={6}
            name="confirm-password"
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError(null);
              setNotice(null);
            }}
            placeholder="Ripeti la nuova password"
            required
            type={showPassword ? "text" : "password"}
            value={confirmation}
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

      <div className="flex justify-end">
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          ) : null}
          {isSubmitting ? "Aggiornamento…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
