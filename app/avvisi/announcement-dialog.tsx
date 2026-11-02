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
  createAnnouncement,
  formatAnnouncementError,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  updateAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from "@/lib/announcements";
import { AlertCircleIcon, MegaphoneIcon, XIcon } from "@/components/icons";

type AnnouncementDialogProps = {
  mode: "create" | "edit";
  announcement?: Announcement;
  onClose: () => void;
  onSaved: (announcement: Announcement) => void;
};

type FormValues = {
  message: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const EMPTY_FORM: FormValues = {
  message: "",
  startDate: "",
  endDate: "",
  isActive: true,
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function initialValues(announcement?: Announcement): FormValues {
  if (!announcement) return EMPTY_FORM;

  return {
    message: announcement.message,
    startDate: toDateTimeLocalValue(announcement.start_date),
    endDate: toDateTimeLocalValue(announcement.end_date),
    isActive: announcement.is_active,
  };
}

export function AnnouncementDialog({
  mode,
  announcement,
  onClose,
  onSaved,
}: AnnouncementDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const [values, setValues] = useState<FormValues>(() =>
    initialValues(announcement),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    messageRef.current?.focus();

    function handleKeyDown(keyboardEvent: globalThis.KeyboardEvent) {
      if (keyboardEvent.key === "Escape" && !isSaving) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSaving, onClose]);

  function updateField<K extends keyof FormValues>(
    field: K,
    value: FormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function handleDialogKeyDown(
    keyboardEvent: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (keyboardEvent.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]',
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

    const message = values.message.trim();
    if (!message) {
      setError("Scrivi il testo dell’avviso.");
      return;
    }

    const start = parseDateTimeLocalValue(values.startDate);
    const end = parseDateTimeLocalValue(values.endDate);

    if (!start.isValid || !end.isValid) {
      setError("Inserisci date valide oppure lascia vuoti i campi.");
      return;
    }

    if (
      start.iso &&
      end.iso &&
      new Date(start.iso).getTime() > new Date(end.iso).getTime()
    ) {
      setError(
        "La data di fine deve essere successiva o uguale alla data di inizio.",
      );
      return;
    }

    if (isEdit && !announcement) {
      setError("L’avviso da modificare non è disponibile.");
      return;
    }

    setIsSaving(true);

    const input: AnnouncementInput = {
      message,
      start_date: start.iso,
      end_date: end.iso,
      is_active: values.isActive,
    };

    const result =
      isEdit && announcement
        ? await updateAnnouncement(announcement.id, input)
        : await createAnnouncement(input);

    if (result.error || !result.announcement) {
      setError(
        formatAnnouncementError(
          result.error ??
            (isEdit
              ? "Impossibile aggiornare l’avviso. Riprova."
              : "Impossibile creare l’avviso. Riprova."),
        ),
      );
      setIsSaving(false);
      return;
    }

    onSaved(result.announcement);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(mouseEvent) => {
        if (!isSaving && mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
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
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <MegaphoneIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                id={titleId}
              >
                {isEdit ? "Modifica avviso" : "Nuovo avviso"}
              </h2>
              <p
                className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400"
                id={descriptionId}
              >
                {isEdit
                  ? "Aggiorna il messaggio o la finestra di pubblicazione."
                  : "Il messaggio comparirà in cima a tutte le pagine del portale."}
              </p>
            </div>
          </div>
          <button
            aria-label="Chiudi"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            disabled={isSaving}
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
              htmlFor={`${fieldId}-message`}
            >
              Messaggio
            </label>
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              disabled={isSaving}
              id={`${fieldId}-message`}
              name="message"
              onChange={(changeEvent) =>
                updateField("message", changeEvent.target.value)
              }
              placeholder="Es. La riunione mensile si terrà sabato alle 18:00."
              ref={messageRef}
              required
              rows={4}
              value={values.message}
            />
            <p className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Testo semplice. Le interruzioni di riga vengono mantenute.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor={`${fieldId}-start`}
              >
                Inizio
                <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  facoltativo
                </span>
              </label>
              <input
                className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
                disabled={isSaving}
                id={`${fieldId}-start`}
                name="start_date"
                onChange={(changeEvent) =>
                  updateField("startDate", changeEvent.target.value)
                }
                type="datetime-local"
                value={values.startDate}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor={`${fieldId}-end`}
              >
                Fine
                <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  facoltativa
                </span>
              </label>
              <input
                className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
                disabled={isSaving}
                id={`${fieldId}-end`}
                name="end_date"
                onChange={(changeEvent) =>
                  updateField("endDate", changeEvent.target.value)
                }
                type="datetime-local"
                value={values.endDate}
              />
            </div>
          </div>

          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Se non indichi date, l’avviso resta visibile finché non lo disattivi
            o elimini. Se indichi solo l’inizio, resta visibile da quel momento
            in poi.
          </p>

          <label
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
            htmlFor={`${fieldId}-active`}
          >
            <input
              checked={values.isActive}
              className="mt-0.5 h-4.5 w-4.5 shrink-0 rounded border-zinc-300 accent-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950"
              disabled={isSaving}
              id={`${fieldId}-active`}
              name="is_active"
              onChange={(changeEvent) =>
                updateField("isActive", changeEvent.target.checked)
              }
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Avviso attivo
              </span>
              <span className="mt-0.5 block text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                Puoi preparare un avviso e attivarlo in un secondo momento
                togliendo questa spunta.
              </span>
            </span>
          </label>

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
              Il messaggio è obbligatorio; le date sono facoltative.
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
                    : "Crea avviso"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
