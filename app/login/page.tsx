"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/brand";
import { ConfigurationNotice } from "@/components/configuration-notice";
import { LoadingScreen } from "@/components/loading-screen";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "@/components/icons";

type Mode = "signin" | "signup";

function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o password non validi.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Conferma la tua email prima di accedere.";
  }
  if (normalized.includes("user already registered")) {
    return "Esiste già un account con questa email.";
  }
  if (normalized.includes("password should be at least")) {
    return "La password deve contenere almeno 6 caratteri.";
  }
  if (normalized.includes("unable to validate email")) {
    return "Inserisci un indirizzo email valido.";
  }
  if (
    normalized.includes("provider is not enabled") ||
    normalized.includes("unsupported provider")
  ) {
    return "L’accesso con Google non è abilitato. Contatta un amministratore.";
  }

  return message;
}

export default function LoginPage() {
  const { user, isLoading: isAuthLoading, isConfigured } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace("/");
    }
  }, [isAuthLoading, user, router]);

  if (!isConfigured) {
    return <ConfigurationNotice />;
  }

  if (isAuthLoading || user) {
    return <LoadingScreen message="Reindirizzamento…" />;
  }

  const isBusy = isSubmitting || isGoogleSubmitting;

  function switchMode(nextMode: Mode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword("");
    setShowPassword(false);
  }

  async function handleGoogleSignIn() {
    if (!supabase) return;

    setError(null);
    setNotice(null);
    setIsGoogleSubmitting(true);

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: "select_account" },
        },
      });

      if (googleError) {
        setError(friendlyAuthError(googleError.message));
        setIsGoogleSubmitting(false);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? friendlyAuthError(error.message)
          : "Errore di rete. Controlla la connessione e riprova.",
      );
      setIsGoogleSubmitting(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    setError(null);
    setNotice(null);

    if (mode === "signup" && !cleanName) {
      setError("Inserisci il tuo nome completo.");
      return;
    }

    if (!cleanEmail) {
      setError("Inserisci il tuo indirizzo email.");
      return;
    }

    if (password.length < 6) {
      setError("La password deve contenere almeno 6 caratteri.");
      return;
    }

    setIsSubmitting(true);

    if (mode === "signin") {
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          setError(friendlyAuthError(signInError.message));
          setIsSubmitting(false);
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? friendlyAuthError(error.message)
            : "Errore di rete. Controlla la connessione e riprova.",
        );
        setIsSubmitting(false);
      }

      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: cleanName },
        },
      });

      if (signUpError) {
        setError(friendlyAuthError(signUpError.message));
        setIsSubmitting(false);
        return;
      }

      if (!data.session) {
        setNotice(
          "Account creato. Controlla la tua email per confermare l’indirizzo, poi accedi.",
        );
        setMode("signin");
        setPassword("");
        setIsSubmitting(false);
      }
      // When email confirmation is disabled, the auth listener redirects to "/".
    } catch (error) {
      setError(
        error instanceof Error
          ? friendlyAuthError(error.message)
          : "Errore di rete. Controlla la connessione e riprova.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-100/80 to-transparent dark:from-emerald-950/40"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl dark:bg-emerald-900/20"
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Brand />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {mode === "signin" ? "Bentornato in gruppo" : "Entra a far parte del gruppo"}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {mode === "signin"
              ? "Accedi al portale per consultare il tuo profilo e le attività del gruppo."
              : "Crea il tuo account per gestire il profilo e partecipare alla vita del gruppo."}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-900/5 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-950">
            {(
              [
                { id: "signin", label: "Accedi" },
                { id: "signup", label: "Registrati" },
              ] as const
            ).map((item) => (
              <button
                aria-pressed={mode === item.id}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  mode === item.id
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
                disabled={isBusy}
                key={item.id}
                onClick={() => switchMode(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            disabled={isBusy}
            onClick={handleGoogleSignIn}
            type="button"
          >
            {isGoogleSubmitting ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200"
              />
            ) : (
              <GoogleIcon className="h-4.5 w-4.5" />
            )}
            Continua con Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              oppure
            </span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            {mode === "signup" ? (
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  htmlFor="full_name"
                >
                  Nome completo
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <input
                    autoComplete="name"
                    className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                    disabled={isBusy}
                    id="full_name"
                    name="full_name"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Mario Rossi"
                    required
                    type="text"
                    value={fullName}
                  />
                </div>
              </div>
            ) : null}

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
                  className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  disabled={isBusy}
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@esempio.it"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-11 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
                  disabled={isBusy}
                  id="password"
                  minLength={6}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Almeno 6 caratteri"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  disabled={isBusy}
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
            </div>

            {error ? (
              <div
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                role="alert"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {notice ? (
              <div
                className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                role="status"
              >
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              disabled={isBusy}
              type="submit"
            >
              {isSubmitting ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              ) : null}
              {mode === "signin" ? "Accedi" : "Crea account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "signin" ? (
              <>
                Non hai ancora un account?{" "}
                <button
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                  disabled={isBusy}
                  onClick={() => switchMode("signup")}
                  type="button"
                >
                  Registrati
                </button>
              </>
            ) : (
              <>
                Hai già un account?{" "}
                <button
                  className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                  disabled={isBusy}
                  onClick={() => switchMode("signin")}
                  type="button"
                >
                  Accedi
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          Accesso riservato ai soci del Gruppo Alpini.
        </p>
      </div>
    </main>
  );
}
