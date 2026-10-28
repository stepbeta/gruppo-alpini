"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { getInitials, getUserDisplayName } from "@/lib/display";
import { fetchProfile, saveProfile, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@/components/icons";

type FormValues = {
  full_name: string;
  birth_date: string;
  enlistment_year: string;
  service_place: string;
};

const EMPTY_FORM: FormValues = {
  full_name: "",
  birth_date: "",
  enlistment_year: "",
  service_place: "",
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function formValuesFromProfile(profile: Profile | null, fallbackName: string): FormValues {
  if (!profile) {
    return { ...EMPTY_FORM, full_name: fallbackName };
  }

  return {
    full_name: profile.full_name ?? fallbackName,
    birth_date: profile.birth_date ?? "",
    enlistment_year:
      profile.enlistment_year === null ? "" : String(profile.enlistment_year),
    service_place: profile.service_place ?? "",
  };
}

function friendlyProfileError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("row-level security")
  ) {
    return "Non hai i permessi per aggiornare il profilo. Verifica che la migrazione di Phase 1B sia stata applicata al database.";
  }
  if (normalized.includes("duplicate key")) {
    return "Esiste già una scheda collegata a questo account.";
  }
  if (normalized.includes("invalid input syntax")) {
    return "Uno dei valori inseriti non è valido. Controlla i campi e riprova.";
  }

  return message;
}

function formatUpdatedAt(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const userId = user?.id;
  const fallbackName = getUserDisplayName(user);
  const fallbackNameRef = useRef(fallbackName);

  useEffect(() => {
    fallbackNameRef.current = fallbackName;
  }, [fallbackName]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMissing, setIsProfileMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchProfile(userId).then(({ profile: nextProfile, error }) => {
      if (!isActive) return;

      if (error) {
        setLoadError(error);
        setValues({ ...EMPTY_FORM, full_name: fallbackNameRef.current });
        setIsLoading(false);
        return;
      }

      setProfile(nextProfile);
      setIsProfileMissing(nextProfile === null);
      setValues(formValuesFromProfile(nextProfile, fallbackNameRef.current));
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [userId]);

  if (!user || !userId) return null;

  const displayName = profile?.full_name?.trim() || fallbackName;
  const initials = getInitials(displayName);
  const updatedAt = profile?.updated_at ? formatUpdatedAt(profile.updated_at) : null;

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setSaveError(null);
    setSaveNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    setSaveError(null);
    setSaveNotice(null);

    const fullName = values.full_name.trim();
    if (!fullName) {
      setSaveError("Inserisci il tuo nome completo.");
      return;
    }

    let enlistmentYear: number | null = null;
    const yearText = values.enlistment_year.trim();

    if (yearText) {
      const parsedYear = Number(yearText);
      const maxYear = new Date().getFullYear();

      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 1900 ||
        parsedYear > maxYear
      ) {
        setSaveError(`Inserisci un anno di leva valido (1900–${maxYear}).`);
        return;
      }

      enlistmentYear = parsedYear;
    }

    setIsSaving(true);

    const { profile: nextProfile, error } = await saveProfile(userId, {
      full_name: fullName,
      birth_date: values.birth_date || null,
      enlistment_year: enlistmentYear,
      service_place: values.service_place.trim() || null,
    });

    if (error) {
      setSaveError(friendlyProfileError(error));
      setIsSaving(false);
      return;
    }

    setProfile(nextProfile);
    setIsProfileMissing(false);
    setLoadError(null);
    setValues(formValuesFromProfile(nextProfile, fullName));
    setSaveNotice("Profilo aggiornato con successo.");
    setIsSaving(false);

    // Keep the name shown in the header in sync with the profile.
    if (
      supabase &&
      nextProfile?.full_name &&
      nextProfile.full_name !== user.user_metadata?.full_name
    ) {
      try {
        await supabase.auth.updateUser({
          data: { full_name: nextProfile.full_name },
        });
      } catch {
        // The profile itself was saved; a metadata sync failure is not fatal.
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-400 dark:hover:text-zinc-100"
          href="/"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
          Torna alla home
        </Link>

        <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {displayName}
                  </h1>
                  {profile?.is_admin ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      Amministratore
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {user.email}
                </p>
              </div>
            </div>

            {updatedAt ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <ClockIcon className="h-3.5 w-3.5" />
                Aggiornato il {updatedAt}
              </p>
            ) : null}
          </div>

          {profile?.is_admin ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Profilo amministratore
                </p>
                <p className="mt-0.5 text-sm leading-6 text-amber-800 dark:text-amber-200">
                  Questo account ha i permessi di amministrazione del gruppo.
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Dati personali
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Mantieni aggiornata la tua scheda: questi dati aiutano il gruppo a
              restare in contatto con te.
            </p>
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-5" aria-label="Caricamento del profilo">
              <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              </div>
              <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ) : (
            <>
              {isProfileMissing ? (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Non abbiamo ancora trovato la tua scheda. Compila i campi e
                    salva per crearla.
                  </span>
                </div>
              ) : null}

              {loadError ? (
                <div
                  className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  role="alert"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Impossibile caricare il profilo: {loadError}</span>
                </div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    htmlFor="full_name"
                  >
                    Nome completo
                  </label>
                  <input
                    autoComplete="name"
                    className={inputClass}
                    disabled={isSaving}
                    id="full_name"
                    name="full_name"
                    onChange={(event) => updateField("full_name", event.target.value)}
                    placeholder="Mario Rossi"
                    required
                    type="text"
                    value={values.full_name}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      htmlFor="birth_date"
                    >
                      Data di nascita
                      <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                        facoltativo
                      </span>
                    </label>
                    <input
                      autoComplete="bday"
                      className={inputClass}
                      disabled={isSaving}
                      id="birth_date"
                      name="birth_date"
                      onChange={(event) => updateField("birth_date", event.target.value)}
                      type="date"
                      value={values.birth_date}
                    />
                  </div>

                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      htmlFor="enlistment_year"
                    >
                      Anno di leva
                      <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                        facoltativo
                      </span>
                    </label>
                    <input
                      className={inputClass}
                      disabled={isSaving}
                      id="enlistment_year"
                      inputMode="numeric"
                      max={new Date().getFullYear()}
                      min={1900}
                      name="enlistment_year"
                      onChange={(event) =>
                        updateField("enlistment_year", event.target.value)
                      }
                      placeholder="Es. 1985"
                      type="number"
                      value={values.enlistment_year}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    htmlFor="service_place"
                  >
                    Luogo di servizio
                    <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                      facoltativo
                    </span>
                  </label>
                  <input
                    className={inputClass}
                    disabled={isSaving}
                    id="service_place"
                    name="service_place"
                    onChange={(event) =>
                      updateField("service_place", event.target.value)
                    }
                    placeholder="Es. Caserma di Belluno"
                    type="text"
                    value={values.service_place}
                  />
                </div>

                {saveError ? (
                  <div
                    className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    role="alert"
                  >
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                ) : null}

                {saveNotice ? (
                  <div
                    className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    role="status"
                  >
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{saveNotice}</span>
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    I campi contrassegnati come facoltativi possono restare vuoti.
                  </p>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    disabled={isSaving}
                    type="submit"
                  >
                    {isSaving ? (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      />
                    ) : null}
                    {isSaving ? "Salvataggio…" : "Salva modifiche"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
        <p className="mx-auto w-full max-w-4xl px-4 text-center text-xs text-zinc-500 sm:px-6 sm:text-left dark:text-zinc-400">
          Gruppo Alpini · Portale riservato ai soci
        </p>
      </footer>
    </div>
  );
}
