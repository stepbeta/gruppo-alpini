"use client";

/**
 * ============================================================================
 * IMPOSTAZIONI PRIVACY — REGOLA DI MANUTENZIONE
 * ============================================================================
 *
 * This administrator surface writes the public controller details rendered by
 * `/privacy`. Whenever fields, validation, navigation, or the caching behavior
 * change, update this form, `docs/architecture/features.md`, roadmap 4.8,
 * security 2.4/2.5, and the administrator manual in the same pull request.
 *
 * The database is the authorization boundary: `authenticated` receives only a
 * column-scoped UPDATE grant, and the policy calls `is_current_user_admin()`.
 * The `isAdmin` check below exists only to avoid showing a doomed form.
 * ============================================================================
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/icons";
import {
  EMPTY_ORGANIZATION_SETTINGS_FORM,
  fetchOrganizationSettingsForAdmin,
  formatOrganizationSettingsError,
  formatOrganizationSettingsUpdatedAt,
  normalizeOrganizationSettingsInput,
  organizationSettingsToForm,
  saveOrganizationSettings,
  validateOrganizationSettings,
  type OrganizationSettingsFormValues,
  type OrganizationSettingsRow,
} from "@/lib/organization-settings";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const PUBLISHED_HINT = "Pubblicato sulla pagina privacy";

function PublishedHint() {
  return (
    <span className="ml-2 text-xs font-normal text-sky-700 dark:text-sky-300">
      {PUBLISHED_HINT}
    </span>
  );
}

export function OrganizationSettingsAdmin() {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState<OrganizationSettingsRow | null>(null);
  const [values, setValues] = useState<OrganizationSettingsFormValues>(
    EMPTY_ORGANIZATION_SETTINGS_FORM,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [showCacheNotice, setShowCacheNotice] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    let isActive = true;

    fetchOrganizationSettingsForAdmin().then(({ settings: row, error }) => {
      if (!isActive) return;

      if (error) {
        setLoadError(formatOrganizationSettingsError(error));
        setIsLoading(false);
        return;
      }

      if (!row) {
        setLoadError(
          "La riga delle impostazioni privacy non è disponibile. Applica le migrazioni Supabase con npm run db:push.",
        );
        setIsLoading(false);
        return;
      }

      setSettings(row);
      setValues(organizationSettingsToForm(row));
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [isAdmin, reloadKey]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <ShieldCheckIcon className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Accesso riservato
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Le impostazioni privacy sono disponibili solo per gli
              amministratori del Gruppo Alpini.
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              href="/"
            >
              Torna alla pagina iniziale
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  function updateField<K extends keyof OrganizationSettingsFormValues>(
    field: K,
    value: OrganizationSettingsFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaveError(null);
    setSaveNotice(null);
    setShowCacheNotice(false);

    const validationError = validateOrganizationSettings(values);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);

    const { settings: saved, error } = await saveOrganizationSettings(
      normalizeOrganizationSettingsInput(values),
    );

    if (error || !saved) {
      setSaveError(
        formatOrganizationSettingsError(
          error ?? "Impossibile salvare le impostazioni privacy. Riprova.",
        ),
      );
      setIsSaving(false);
      return;
    }

    setSettings(saved);
    setValues(organizationSettingsToForm(saved));
    setSaveNotice(
      `Impostazioni salvate. Ultimo aggiornamento: ${formatOrganizationSettingsUpdatedAt(
        saved.updated_at,
      )}.`,
    );
    setShowCacheNotice(true);
    setIsSaving(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm sm:p-8 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-sky-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-zinc-950/60 dark:text-emerald-300">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              Solo amministratori
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <ClockIcon className="h-3.5 w-3.5" />
              Ultima modifica:{" "}
              {isLoading
                ? "caricamento…"
                : formatOrganizationSettingsUpdatedAt(
                    settings?.updated_at ?? null,
                  )}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Impostazioni privacy
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-300">
            Questi dati identificano il titolare del trattamento e compaiono
            nella pagina pubblica <strong>/privacy</strong>. Le modifiche sono
            registrate subito nel database; la pagina pubblica le mostra secondo
            la cache descritta qui sotto.
          </p>
        </div>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              <LockIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Dati del titolare del trattamento
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                I campi contrassegnati come “Pubblicato sulla pagina privacy”
                sono visibili a chiunque apra <strong>/privacy</strong>, anche
                senza account.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 space-y-4" role="status">
              <span className="sr-only">Caricamento impostazioni privacy…</span>
              <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-11 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ) : loadError ? (
            <div className="mt-6 space-y-4">
              <div
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                role="alert"
              >
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loadError}</span>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(null);
                  setReloadKey((key) => key + 1);
                }}
                type="button"
              >
                Ricarica i dati
              </button>
            </div>
          ) : (
            <form
              aria-busy={isSaving}
              className="mt-6 space-y-5"
              noValidate
              onSubmit={handleSubmit}
            >
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  htmlFor="organization_name"
                >
                  Nome del titolare
                  <PublishedHint />
                </label>
                <input
                  aria-describedby="organization_name_hint"
                  autoComplete="organization"
                  className={inputClass}
                  disabled={isSaving}
                  id="organization_name"
                  name="organization_name"
                  onChange={(event) =>
                    updateField("organization_name", event.target.value)
                  }
                  placeholder="Gruppo Alpini"
                  required
                  type="text"
                  value={values.organization_name}
                />
                <p
                  className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                  id="organization_name_hint"
                >
                  È il nome mostrato come titolare del trattamento. Il campo è
                  obbligatorio.
                </p>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  htmlFor="address"
                >
                  Sede
                  <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                    facoltativo
                  </span>
                  <PublishedHint />
                </label>
                <textarea
                  aria-describedby="address_hint"
                  autoComplete="street-address"
                  className={inputClass}
                  disabled={isSaving}
                  id="address"
                  name="address"
                  onChange={(event) => updateField("address", event.target.value)}
                  placeholder="Es. Via Roma 1, 32100 Belluno (BL)"
                  rows={3}
                  value={values.address}
                />
                <p
                  className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                  id="address_hint"
                >
                  Se lasci il campo vuoto, la pagina pubblica mostra “indirizzo
                  non ancora pubblicato”.
                </p>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  htmlFor="contact_email"
                >
                  Email di contatto
                  <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                    facoltativo
                  </span>
                  <PublishedHint />
                </label>
                <input
                  aria-describedby="contact_email_hint"
                  autoComplete="email"
                  className={inputClass}
                  disabled={isSaving}
                  id="contact_email"
                  inputMode="email"
                  name="contact_email"
                  onChange={(event) =>
                    updateField("contact_email", event.target.value)
                  }
                  placeholder="segreteria@example.it"
                  type="email"
                  value={values.contact_email}
                />
                <p
                  className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                  id="contact_email_hint"
                >
                  Indirizzo a cui i soci e i visitatori possono scrivere per
                  esercitare i propri diritti. Se vuoto, la pagina pubblica
                  invita a contattare gli amministratori.
                </p>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  htmlFor="dpo_email"
                >
                  Email del DPO
                  <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                    facoltativo
                  </span>
                  <PublishedHint />
                </label>
                <input
                  aria-describedby="dpo_email_hint"
                  autoComplete="email"
                  className={inputClass}
                  disabled={isSaving}
                  id="dpo_email"
                  inputMode="email"
                  name="dpo_email"
                  onChange={(event) =>
                    updateField("dpo_email", event.target.value)
                  }
                  placeholder="dpo@example.it"
                  type="email"
                  value={values.dpo_email}
                />
                <p
                  className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                  id="dpo_email_hint"
                >
                  Se il gruppo non ha un DPO, lascia il campo vuoto: la riga
                  dedicata non viene mostrata sulla pagina pubblica.
                </p>
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

              {showCacheNotice ? (
                <div
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  role="status"
                >
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="flex-1 leading-6">
                    La pagina privacy pubblica può impiegare fino a un&apos;ora
                    per riflettere le modifiche a causa della cache.
                  </p>
                  <button
                    aria-label="Chiudi l’avviso sulla cache"
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-700 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/60"
                    onClick={() => setShowCacheNotice(false)}
                    type="button"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-start gap-2.5">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="leading-6">
                    La pagina privacy pubblica può impiegare fino a un&apos;ora
                    per riflettere le modifiche a causa della cache. Il
                    salvataggio qui è immediato e il database conserva già i
                    nuovi valori.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                <div className="flex items-start gap-2.5">
                  <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="leading-6">
                    Modificare questi dati non richiede un nuovo consenso ai
                    soci. Il consenso viene richiesto solo quando cambia il
                    testo dell’informativa e la sua versione (attualmente{" "}
                    <strong>{PRIVACY_POLICY_VERSION}</strong>).
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  La data di ultima modifica è gestita dal database e non può
                  essere impostata dal browser.
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
                  {isSaving ? "Salvataggio…" : "Salva impostazioni"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
