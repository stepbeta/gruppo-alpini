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
  createEventTemplate,
  deleteEventTemplate,
  fetchEventTemplates,
  formatEventTemplateError,
  normalizeEventTemplateTime,
  updateEventTemplate,
  validateEventTemplateInput,
  type EventTemplate,
  type EventTemplateInput,
} from "@/lib/event-templates";
import { maskItalianTimeInput } from "@/lib/italian-date";
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

type EventTemplatesDialogProps = {
  onClose: () => void;
  onChanged?: () => void;
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; template: EventTemplate };

type TemplateFormValues = {
  title: string;
  description: string;
  location: string;
  isAllDay: boolean;
  time: string;
};

const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500";

function templateTimeLabel(template: EventTemplate): string {
  if (template.is_all_day) return "Tutta la giornata";

  return (
    normalizeEventTemplateTime(template.default_time) ?? "Orario da definire"
  );
}

function sortTemplates(templates: EventTemplate[]): EventTemplate[] {
  return [...templates].sort((first, second) =>
    first.title.localeCompare(second.title, "it", { sensitivity: "base" }),
  );
}

function templateFormValues(template?: EventTemplate): TemplateFormValues {
  if (!template) {
    return {
      title: "",
      description: "",
      location: "",
      isAllDay: true,
      time: "",
    };
  }

  return {
    title: template.title,
    description: template.description ?? "",
    location: template.location ?? "",
    isAllDay: template.is_all_day,
    time: template.is_all_day
      ? ""
      : normalizeEventTemplateTime(template.default_time) ?? "",
  };
}

type TemplateFormProps =
  | {
      mode: "create";
      template?: undefined;
      onCancel: () => void;
      onSaved: (template: EventTemplate) => void;
      onSavingChange: (saving: boolean) => void;
    }
  | {
      mode: "edit";
      template: EventTemplate;
      onCancel: () => void;
      onSaved: (template: EventTemplate) => void;
      onSavingChange: (saving: boolean) => void;
    };

function TemplateForm({
  mode,
  template,
  onCancel,
  onSaved,
  onSavingChange,
}: TemplateFormProps) {
  const fieldId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<TemplateFormValues>(() =>
    templateFormValues(template),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  useEffect(() => {
    onSavingChange(isSaving);

    return () => onSavingChange(false);
  }, [isSaving, onSavingChange]);

  function updateField<K extends keyof TemplateFormValues>(
    field: K,
    value: TemplateFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError(null);

    const input: EventTemplateInput = {
      title: values.title,
      description: values.description.trim() || null,
      location: values.location.trim() || null,
      is_all_day: values.isAllDay,
      default_time: values.isAllDay ? null : values.time.trim() || null,
    };

    const validationError = validateEventTemplateInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    const result =
      isEdit && template
        ? await updateEventTemplate(template.id, input)
        : await createEventTemplate(input);

    if (result.error || !result.template) {
      setError(
        formatEventTemplateError(
          result.error ??
            (isEdit
              ? "Impossibile aggiornare il modello. Riprova."
              : "Impossibile creare il modello. Riprova."),
        ),
      );
      setIsSaving(false);
      return;
    }

    onSaved(result.template);
  }

  return (
    <form
      className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {isEdit ? "Modifica modello" : "Nuovo modello evento"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            {isEdit
              ? "Aggiorna i dettagli che verranno proposti durante la creazione di un evento."
              : "Salva i dettagli ricorrenti. La data resta fuori dal modello: la scegli ogni volta."}
          </p>
        </div>
        <button
          aria-label="Annulla modifica modello"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
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
            placeholder="Es. Riunione mensile"
            ref={titleInputRef}
            required
            type="text"
            value={values.title}
          />
        </div>

        <div>
          <label className="flex items-start gap-3 rounded-xl border border-zinc-300 bg-white px-3.5 py-3 dark:border-zinc-700 dark:bg-zinc-950">
            <input
              checked={values.isAllDay}
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
              disabled={isSaving}
              id={`${fieldId}-all-day`}
              onChange={(changeEvent) =>
                setValues((current) => ({
                  ...current,
                  isAllDay: changeEvent.target.checked,
                  time: changeEvent.target.checked ? "" : current.time,
                }))
              }
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Tutta la giornata
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Se attivo, il modello non propone un orario. Disattivalo per
                salvare un orario predefinito.
              </span>
            </span>
          </label>
        </div>

        {!values.isAllDay ? (
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              htmlFor={`${fieldId}-time`}
            >
              Orario predefinito
              <span className="ml-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                HH:mm (24 ore)
              </span>
            </label>
            <input
              autoComplete="off"
              className={inputClass}
              disabled={isSaving}
              id={`${fieldId}-time`}
              inputMode="numeric"
              maxLength={5}
              name="default_time"
              onChange={(changeEvent) =>
                updateField(
                  "time",
                  maskItalianTimeInput(changeEvent.target.value),
                )
              }
              placeholder="19:00"
              required
              type="text"
              value={values.time}
            />
          </div>
        ) : null}

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
            className={`${inputClass} min-h-24 resize-y`}
            disabled={isSaving}
            id={`${fieldId}-description`}
            name="description"
            onChange={(changeEvent) =>
              updateField("description", changeEvent.target.value)
            }
            placeholder="Informazioni utili da riproporre nell’evento."
            rows={3}
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

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className={secondaryButtonClass}
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Annulla
          </button>
          <button
            className={primaryButtonClass}
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
              ? "Salvataggio…"
              : isEdit
                ? "Salva modifiche"
                : "Crea modello"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function EventTemplatesDialog({
  onClose,
  onChanged,
}: EventTemplatesDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const newTemplateButtonRef = useRef<HTMLButtonElement>(null);

  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [isFormSaving, setIsFormSaving] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    newTemplateButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    fetchEventTemplates().then((result) => {
      if (!isActive) return;

      setTemplates(result.templates);
      setLoadError(
        result.error ? formatEventTemplateError(result.error) : null,
      );
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    function handleKeyDown(keyboardEvent: globalThis.KeyboardEvent) {
      if (
        keyboardEvent.key !== "Escape" ||
        isDeleting ||
        isFormSaving
      ) {
        return;
      }

      if (editor) {
        setEditor(null);
        return;
      }

      if (confirmingDeleteId) {
        setConfirmingDeleteId(null);
        setDeleteError(null);
        return;
      }

      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmingDeleteId, editor, isDeleting, isFormSaving, onClose]);

  function handleDialogKeyDown(
    keyboardEvent: ReactKeyboardEvent<HTMLDivElement>,
  ) {
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

  function openCreate() {
    setEditor({ mode: "create" });
    setConfirmingDeleteId(null);
    setDeleteError(null);
    setNotice(null);
  }

  function openEdit(template: EventTemplate) {
    setEditor({ mode: "edit", template });
    setConfirmingDeleteId(null);
    setDeleteError(null);
    setNotice(null);
  }

  function openDelete(template: EventTemplate) {
    setEditor(null);
    setConfirmingDeleteId(template.id);
    setDeleteError(null);
    setNotice(null);
  }

  function handleTemplateSaved(saved: EventTemplate) {
    const wasEditing = editor?.mode === "edit";

    setTemplates((current) =>
      sortTemplates([
        ...current.filter((template) => template.id !== saved.id),
        saved,
      ]),
    );
    setEditor(null);
    setConfirmingDeleteId(null);
    setNotice(
      wasEditing
        ? `Modello “${saved.title}” aggiornato.`
        : `Modello “${saved.title}” creato.`,
    );
    onChanged?.();
  }

  async function handleConfirmDelete(template: EventTemplate) {
    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteEventTemplate(template.id);

    if (result.error) {
      setDeleteError(
        formatEventTemplateError(
          result.error ?? "Impossibile eliminare il modello. Riprova.",
        ),
      );
      setIsDeleting(false);
      return;
    }

    setTemplates((current) =>
      current.filter((item) => item.id !== template.id),
    );
    setConfirmingDeleteId(null);
    setNotice(`Modello “${template.title}” eliminato.`);
    setIsDeleting(false);
    onChanged?.();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(mouseEvent) => {
        if (
          !isDeleting &&
          !isFormSaving &&
          mouseEvent.target === mouseEvent.currentTarget
        ) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-zinc-900"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                id={titleId}
              >
                Modelli evento
              </h2>
              <p
                className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300"
                id={descriptionId}
              >
                Salva i dettagli ricorrenti e riutilizzali quando crei un nuovo
                evento. I modelli sono visibili solo agli amministratori.
              </p>
            </div>
          </div>
          <button
            aria-label="Chiudi"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            disabled={isDeleting || isFormSaving}
            onClick={onClose}
            type="button"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {templates.length === 1
              ? "1 modello disponibile"
              : `${templates.length} modelli disponibili`}
          </p>
          <button
            className={primaryButtonClass}
            disabled={isFormSaving || isDeleting}
            onClick={openCreate}
            ref={newTemplateButtonRef}
            type="button"
          >
            <PlusIcon className="h-4 w-4" />
            Nuovo modello
          </button>
        </div>

        {editor ? (
          <div className="mt-4">
            {editor.mode === "edit" ? (
              <TemplateForm
                key={`edit-${editor.template.id}`}
                mode="edit"
                onCancel={() => setEditor(null)}
                onSaved={handleTemplateSaved}
                onSavingChange={setIsFormSaving}
                template={editor.template}
              />
            ) : (
              <TemplateForm
                key="create"
                mode="create"
                onCancel={() => setEditor(null)}
                onSaved={handleTemplateSaved}
                onSavingChange={setIsFormSaving}
              />
            )}
          </div>
        ) : null}

        {notice ? (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            role="status"
          >
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
            />
            <span role="status">Caricamento modelli…</span>
          </div>
        ) : loadError ? (
          <div
            className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Impossibile caricare i modelli
                </p>
                <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-200">
                  {loadError}
                </p>
                <button
                  className="mt-3 inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                  onClick={() => {
                    setIsLoading(true);
                    setLoadError(null);
                    setReloadKey((current) => current + 1);
                  }}
                  type="button"
                >
                  Riprova
                </button>
              </div>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div
            className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950/60"
            role="status"
          >
            <CalendarIcon className="mx-auto h-9 w-9 text-zinc-400 dark:text-zinc-500" />
            <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Nessun modello evento
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Crea un modello per riutilizzare titolo, luogo, descrizione e
              orario senza ricompilare ogni volta.
            </p>
            <button
              className={`${primaryButtonClass} mt-4`}
              onClick={openCreate}
              type="button"
            >
              <PlusIcon className="h-4 w-4" />
              Crea il primo modello
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {templates.map((template) => (
              <li
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/60"
                key={template.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold wrap-break-word text-zinc-900 dark:text-zinc-50">
                      {template.title}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {templateTimeLabel(template)}
                      </span>
                      {template.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="h-3.5 w-3.5" />
                          {template.location}
                        </span>
                      ) : null}
                    </p>
                    {template.description ? (
                      <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                        {template.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      aria-label={`Modifica ${template.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      disabled={isFormSaving || isDeleting}
                      onClick={() => openEdit(template)}
                      type="button"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      aria-label={`Elimina ${template.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                      disabled={isFormSaving || isDeleting}
                      onClick={() => openDelete(template)}
                      type="button"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {confirmingDeleteId === template.id ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <p className="text-sm leading-6 text-red-800 dark:text-red-200">
                      Eliminare il modello “{template.title}”? Gli eventi già
                      creati non cambiano.
                    </p>
                    {deleteError ? (
                      <p
                        className="mt-2 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
                        role="alert"
                      >
                        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{deleteError}</span>
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        disabled={isDeleting}
                        onClick={() => {
                          setConfirmingDeleteId(null);
                          setDeleteError(null);
                        }}
                        type="button"
                      >
                        Annulla
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-500"
                        disabled={isDeleting}
                        onClick={() => handleConfirmDelete(template)}
                        type="button"
                      >
                        {isDeleting ? (
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          />
                        ) : (
                          <TrashIcon className="h-4 w-4" />
                        )}
                        {isDeleting ? "Eliminazione…" : "Elimina modello"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
