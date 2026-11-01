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
  createEvent,
  formatEventDateInput,
  formatEventError,
  maskItalianDateInput,
  maskItalianTimeInput,
  parseEventDateTime,
  updateEvent,
  type EventRecord,
} from "@/lib/events";
import { AlertCircleIcon, XIcon } from "@/components/icons";

type EventDialogProps = {
  mode: "create" | "edit";
  event?: EventRecord;
  onClose: () => void;
  onSaved: (event: EventRecord) => void;
};

type FormValues = {
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
};

const EMPTY_FORM: FormValues = {
  title: "",
  date: "",
  time: "",
  location: "",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function initialValues(event?: EventRecord): FormValues {
  if (!event) return EMPTY_FORM;

  const dateTime = formatEventDateInput(event.event_date, event.is_all_day);

  return {
    title: event.title,
    date: dateTime.date,
    time: dateTime.time,
    location: event.location ?? "",
    description: event.description ?? "",
  };
}

export function EventDialog({
  mode,
  event,
  onClose,
  onSaved,
}: EventDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<FormValues>(() => initialValues(event));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleInputRef.current?.focus();

    function handleKeyDown(keyboardEvent: globalThis.KeyboardEvent) {
      if (keyboardEvent.key === "Escape") onClose();
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

  function handleDialogKeyDown(keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) {
    if (keyboardEvent.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
    );

    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError(null);

    const title = values.title.trim();
    if (!title) {
      setError("Inserisci il titolo dell’evento.");
      return;
    }

    if (!values.date) {
      setError("Inserisci la data dell’evento.");
      return;
    }

    const eventDateTime = parseEventDateTime(values.date, values.time);
    if (!eventDateTime) {
      setError(
        "Inserisci una data valida nel formato gg/mm/aaaa. Se indichi l’ora, usa il formato HH:mm (24 ore).",
      );
      return;
    }

    if (isEdit && !event) {
      setError("L’evento da modificare non è disponibile.");
      return;
    }

    setIsSaving(true);

    const input = {
      title,
      event_date: eventDateTime.date.toISOString(),
      is_all_day: eventDateTime.isAllDay,
      location: values.location.trim() || null,
      description: values.description.trim() || null,
    };

    const result =
      isEdit && event
        ? await updateEvent(event.id, input)
        : await createEvent(input);

    if (result.error || !result.event) {
      setError(
        formatEventError(
          result.error ??
            (isEdit
              ? "Impossibile aggiornare l’evento. Riprova."
              : "Impossibile creare l’evento. Riprova."),
        ),
      );
      setIsSaving(false);
      return;
    }

    onSaved(result.event);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        aria-busy={isSaving}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-zinc-900"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
              Calendario del gruppo
            </p>
            <h2
              className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              id={titleId}
            >
              {isEdit ? "Modifica evento" : "Nuovo evento"}
            </h2>
            <p
              className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400"
              id={descriptionId}
            >
              {isEdit
                ? "Aggiorna i dettagli dell’evento. Le risposte dei soci restano invariate."
                : "Inserisci i dettagli; l’evento sarà visibile a tutti i soci."}
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
              htmlFor={`${fieldId}-title`}
            >
              Titolo
            </label>
            <input
              className={inputClass}
              disabled={isSaving}
              id={`${fieldId}-title`}
              name="title"
              onChange={(changeEvent) =>
                updateField("title", changeEvent.target.value)
              }
              placeholder="Es. Pranzo sociale di primavera"
              ref={titleInputRef}
              required
              type="text"
              value={values.title}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor={`${fieldId}-date`}
              >
                Data
                <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  gg/mm/aaaa
                </span>
              </label>
              <input
                aria-describedby={`${fieldId}-date-hint`}
                autoComplete="off"
                className={inputClass}
                disabled={isSaving}
                id={`${fieldId}-date`}
                inputMode="numeric"
                maxLength={10}
                name="event_date"
                onChange={(changeEvent) =>
                  updateField(
                    "date",
                    maskItalianDateInput(changeEvent.target.value),
                  )
                }
                placeholder="25/12/2026"
                required
                type="text"
                value={values.date}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor={`${fieldId}-time`}
              >
                Ora
                <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  facoltativa · HH:mm (24 ore)
                </span>
              </label>
              <input
                aria-describedby={`${fieldId}-date-hint`}
                autoComplete="off"
                className={inputClass}
                disabled={isSaving}
                id={`${fieldId}-time`}
                inputMode="numeric"
                maxLength={5}
                name="event_time"
                onChange={(changeEvent) =>
                  updateField(
                    "time",
                    maskItalianTimeInput(changeEvent.target.value),
                  )
                }
                placeholder="19:00"
                type="text"
                value={values.time}
              />
            </div>
          </div>

          <p
            className="text-xs leading-5 text-zinc-500 dark:text-zinc-400"
            id={`${fieldId}-date-hint`}
          >
            Usa il formato italiano: data gg/mm/aaaa e, se serve, ora HH:mm
            senza AM/PM. Senza ora l’evento sarà considerato di tutta la
            giornata e mostrerà solo la data.
          </p>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor={`${fieldId}-location`}
            >
              Luogo
              <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                facoltativo
              </span>
            </label>
            <input
              className={inputClass}
              disabled={isSaving}
              id={`${fieldId}-location`}
              name="location"
              onChange={(changeEvent) =>
                updateField("location", changeEvent.target.value)
              }
              placeholder="Es. Sede del gruppo"
              type="text"
              value={values.location}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor={`${fieldId}-description`}
            >
              Descrizione
              <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                facoltativa
              </span>
            </label>
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              disabled={isSaving}
              id={`${fieldId}-description`}
              name="description"
              onChange={(changeEvent) =>
                updateField("description", changeEvent.target.value)
              }
              placeholder="Aggiungi le informazioni utili per i soci."
              rows={4}
              value={values.description}
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
              Titolo e data sono obbligatori; l’ora è facoltativa.
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
                {isSaving
                  ? isEdit
                    ? "Salvataggio…"
                    : "Creazione…"
                  : isEdit
                    ? "Salva modifiche"
                    : "Crea evento"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
