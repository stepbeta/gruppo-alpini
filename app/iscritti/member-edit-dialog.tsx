"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  formatProfileError,
  updateMemberProfile,
  type Member,
} from "@/lib/profile";
import { AlertCircleIcon, TrashIcon, XIcon } from "@/components/icons";

type MemberEditDialogProps = {
  member: Member;
  onClose: () => void;
  onSaved: (member: Member) => void;
  onDelete: () => void;
};

type FormValues = {
  full_name: string;
  birth_date: string;
  enlistment_year: string;
  service_place: string;
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function formValuesFromMember(member: Member): FormValues {
  return {
    full_name: member.full_name ?? "",
    birth_date: member.birth_date ?? "",
    enlistment_year:
      member.enlistment_year === null ? "" : String(member.enlistment_year),
    service_place: member.service_place ?? "",
  };
}

export function MemberEditDialog({
  member,
  onClose,
  onSaved,
  onDelete,
}: MemberEditDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<FormValues>(() =>
    formValuesFromMember(member),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fullNameInputRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function updateField<K extends keyof FormValues>(
    field: K,
    value: FormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    );

    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const fullName = values.full_name.trim();
    if (!fullName) {
      setError("Inserisci il nome completo dell’iscritto.");
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
        setError(`Inserisci un anno di leva valido (1900–${maxYear}).`);
        return;
      }

      enlistmentYear = parsedYear;
    }

    setIsSaving(true);

    const { member: updatedMember, error: updateError } =
      await updateMemberProfile(member.id, {
        full_name: fullName,
        birth_date: values.birth_date || null,
        enlistment_year: enlistmentYear,
        service_place: values.service_place.trim() || null,
      });

    if (updateError || !updatedMember) {
      setError(
        formatProfileError(
          updateError ?? "Impossibile aggiornare la scheda. Riprova.",
        ),
      );
      setIsSaving(false);
      return;
    }

    onSaved(updatedMember);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-zinc-900"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              Scheda socio
            </p>
            <h2
              className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              id={titleId}
            >
              Modifica iscritto
            </h2>
            <p
              className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400"
              id={descriptionId}
            >
              Aggiorna i dati di{" "}
              {member.full_name?.trim() || "questo iscritto"}.
            </p>
          </div>
          <button
            aria-label="Chiudi"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            onClick={onClose}
            type="button"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor={`${fieldId}-full-name`}
            >
              Nome completo
            </label>
            <input
              autoComplete="name"
              className={inputClass}
              disabled={isSaving}
              id={`${fieldId}-full-name`}
              name="full_name"
              onChange={(event) => updateField("full_name", event.target.value)}
              placeholder="Mario Rossi"
              ref={fullNameInputRef}
              required
              type="text"
              value={values.full_name}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor={`${fieldId}-birth-date`}
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
                id={`${fieldId}-birth-date`}
                name="birth_date"
                onChange={(event) =>
                  updateField("birth_date", event.target.value)
                }
                type="date"
                value={values.birth_date}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor={`${fieldId}-enlistment-year`}
              >
                Anno di leva
                <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  facoltativo
                </span>
              </label>
              <input
                className={inputClass}
                disabled={isSaving}
                id={`${fieldId}-enlistment-year`}
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
              htmlFor={`${fieldId}-service-place`}
            >
              Luogo di servizio
              <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                facoltativo
              </span>
            </label>
            <input
              className={inputClass}
              disabled={isSaving}
              id={`${fieldId}-service-place`}
              name="service_place"
              onChange={(event) =>
                updateField("service_place", event.target.value)
              }
              placeholder="Es. Caserma di Belluno"
              type="text"
              value={values.service_place}
            />
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

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              I campi facoltativi possono restare vuoti.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <button
                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                disabled={isSaving}
                onClick={onClose}
                type="button"
              >
                Annulla
              </button>
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
          </div>
        </form>

        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
              <TrashIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                Elimina account
              </p>
              <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-200">
                Rimuove definitivamente l’accesso e la scheda di{" "}
                {member.full_name?.trim() || "questo iscritto"}. Le risposte agli
                eventi e le richieste già inviate restano conservate in forma
                anonima.
              </p>
              <button
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                disabled={isSaving}
                onClick={onDelete}
                type="button"
              >
                <TrashIcon className="h-4 w-4" />
                Elimina account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
