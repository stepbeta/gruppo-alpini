"use client";

/**
 * ============================================================================
 * CONTEXTUAL GUIDANCE — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever features, workflows, validation rules, or routes are modified in
 * the application, these contextual helpers, empty states, and error messages
 * must be reviewed and updated simultaneously in the same pull request to keep
 * user guidance fully aligned with the current code.
 *
 * In pratica: se cambi i campi della scheda socio, i formati di data o le
 * regole sull’anno di leva, aggiorna esempi e messaggi di errore.
 * ============================================================================
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  formatAdminRoleError,
  formatProfileError,
  promoteToAdmin,
  updateMemberApproval,
  updateMemberProfile,
  validateEnlistmentYear,
  type ApprovalStatus,
  type Member,
} from "@/lib/profile";
import {
  downloadUserDataExport,
  fetchUserDataExport,
  type ExportFormat,
} from "@/lib/data-export";
import {
  formatItalianDateInput,
  maskItalianDateInput,
  parseItalianDateToIsoDate,
} from "@/lib/italian-date";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  ShieldCheckIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { RevokeAdminDialog } from "./revoke-admin-dialog";

type MemberEditDialogProps = {
  member: Member;
  currentUserId: string | null;
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

const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: "In attesa",
  approved: "Approvato",
  rejected: "Rifiutato",
};

const APPROVAL_DESCRIPTIONS: Record<ApprovalStatus, string> = {
  pending:
    "L’account può accedere solo alla schermata di attesa finché non viene approvato.",
  approved:
    "L’account può usare il portale, consultare iscritti ed eventi e inviare richieste.",
  rejected:
    "L’account è bloccato. Puoi approvarlo se la richiesta va rivalutata.",
};

const APPROVAL_TONES: Record<
  ApprovalStatus,
  {
    card: string;
    icon: string;
    title: string;
    text: string;
    badge: string;
  }
> = {
  pending: {
    card: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    title: "text-amber-900 dark:text-amber-100",
    text: "text-amber-800 dark:text-amber-200",
    badge:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  approved: {
    card: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    title: "text-emerald-900 dark:text-emerald-100",
    text: "text-emerald-800 dark:text-emerald-200",
    badge:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  rejected: {
    card: "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30",
    icon: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
    title: "text-red-900 dark:text-red-100",
    text: "text-red-800 dark:text-red-200",
    badge:
      "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300",
  },
};

function formValuesFromMember(member: Member): FormValues {
  return {
    full_name: member.full_name ?? "",
    birth_date: formatItalianDateInput(member.birth_date),
    enlistment_year:
      member.enlistment_year === null ? "" : String(member.enlistment_year),
    service_place: member.service_place ?? "",
  };
}

export function MemberEditDialog({
  member,
  currentUserId,
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
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isUpdatingApproval, setIsUpdatingApproval] = useState<
    "approved" | "rejected" | null
  >(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null,
  );
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isPromotingAdmin, setIsPromotingAdmin] = useState(false);
  const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false);

  const isSelf = currentUserId === member.id;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!isRevokeConfirmOpen) {
      fullNameInputRef.current?.focus();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      // The revoke confirmation is a separate topmost dialog and handles its
      // own Escape key. Do not close the edit dialog underneath it.
      if (event.key === "Escape" && !isRevokeConfirmOpen) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, isRevokeConfirmOpen]);

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

    let birthDate: string | null = null;
    const birthDateText = values.birth_date.trim();

    if (birthDateText) {
      birthDate = parseItalianDateToIsoDate(birthDateText);

      if (!birthDate) {
        setError(
          "Inserisci una data di nascita valida nel formato gg/mm/aaaa (es. 14/03/1985), oppure lascia il campo vuoto.",
        );
        return;
      }
    }

    const yearValidation = validateEnlistmentYear(values.enlistment_year);

    if (yearValidation.error) {
      setError(yearValidation.error);
      return;
    }

    const enlistmentYear = yearValidation.enlistmentYear;

    setIsSaving(true);

    const { member: updatedMember, error: updateError } =
      await updateMemberProfile(member.id, {
        full_name: fullName,
        birth_date: birthDate,
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

  async function handleApprovalChange(nextStatus: "approved" | "rejected") {
    if (isSelf || isUpdatingApproval !== null || isSaving) return;

    setApprovalError(null);
    setIsUpdatingApproval(nextStatus);

    const { member: updatedMember, error: approvalUpdateError } =
      await updateMemberApproval(member.id, nextStatus);

    if (approvalUpdateError || !updatedMember) {
      setApprovalError(
        formatProfileError(
          approvalUpdateError ??
            "Impossibile aggiornare lo stato dell’account. Riprova.",
        ),
      );
      setIsUpdatingApproval(null);
      return;
    }

    onSaved(updatedMember);
  }

  async function handlePromoteAdmin() {
    if (
      member.is_admin ||
      member.approval_status !== "approved" ||
      isPromotingAdmin ||
      isSaving
    ) {
      return;
    }

    setAdminError(null);
    setIsPromotingAdmin(true);

    const { member: updatedMember, error: promoteError } =
      await promoteToAdmin(member.id);

    if (promoteError || !updatedMember) {
      // The database owns the four-administrator cap. Surface its message
      // verbatim instead of pre-hiding the action from a stale client count.
      setAdminError(
        formatAdminRoleError(
          promoteError ?? "Impossibile assegnare il ruolo. Riprova.",
        ),
      );
      setIsPromotingAdmin(false);
      return;
    }

    setIsPromotingAdmin(false);
    onSaved(updatedMember);
  }

  function handleRevoked(updatedMember: Member) {
    setIsRevokeConfirmOpen(false);
    onSaved(updatedMember);
  }

  async function handleExport(format: ExportFormat) {
    if (exportingFormat) return;

    setExportError(null);
    setExportingFormat(format);

    const { data, error: exportRequestError } = await fetchUserDataExport(
      member.id,
    );

    if (exportRequestError || !data) {
      setExportError(
        exportRequestError ??
          "Impossibile preparare l’esportazione. Riprova tra poco.",
      );
      setExportingFormat(null);
      return;
    }

    downloadUserDataExport(data, format, member.full_name ?? "socio");
    setExportingFormat(null);
  }

  const approvalTone = APPROVAL_TONES[member.approval_status];

  return (
    <>
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
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-zinc-900"
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

        <div
          className={`mt-6 rounded-2xl border p-4 ${approvalTone.card}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${approvalTone.icon}`}
            >
              {member.approval_status === "approved" ? (
                <CheckCircleIcon className="h-4.5 w-4.5" />
              ) : member.approval_status === "rejected" ? (
                <AlertCircleIcon className="h-4.5 w-4.5" />
              ) : (
                <ClockIcon className="h-4.5 w-4.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`text-sm font-semibold ${approvalTone.title}`}
                >
                  Stato dell’account
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${approvalTone.badge}`}
                >
                  {APPROVAL_LABELS[member.approval_status]}
                </span>
              </div>
              <p
                className={`mt-1 text-sm leading-6 ${approvalTone.text}`}
              >
                {APPROVAL_DESCRIPTIONS[member.approval_status]}
              </p>

              {isSelf ? (
                <p className={`mt-3 text-sm leading-6 ${approvalTone.text}`}>
                  Non puoi modificare lo stato del tuo account.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {member.approval_status !== "approved" ? (
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      disabled={isUpdatingApproval !== null || isSaving}
                      onClick={() => handleApprovalChange("approved")}
                      type="button"
                    >
                      {isUpdatingApproval === "approved" ? (
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        />
                      ) : (
                        <ShieldCheckIcon className="h-4 w-4" />
                      )}
                      {isUpdatingApproval === "approved"
                        ? "Approvazione…"
                        : "Approva iscritto"}
                    </button>
                  ) : null}

                  {member.approval_status !== "rejected" ? (
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                      disabled={isUpdatingApproval !== null || isSaving}
                      onClick={() => handleApprovalChange("rejected")}
                      type="button"
                    >
                      {isUpdatingApproval === "rejected" ? (
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-700 dark:border-red-800 dark:border-t-red-300"
                        />
                      ) : (
                        <XIcon className="h-4 w-4" />
                      )}
                      {isUpdatingApproval === "rejected"
                        ? "Aggiornamento…"
                        : member.approval_status === "approved"
                          ? "Revoca approvazione"
                          : "Rifiuta richiesta"}
                    </button>
                  ) : null}
                </div>
              )}

              {approvalError ? (
                <div
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  role="alert"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{approvalError}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              <ShieldCheckIcon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
                  Gestione amministratore
                </p>
                <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                  {member.is_admin ? "Amministratore" : "Utente"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-sky-900 dark:text-sky-200">
                Il ruolo di amministratore si assegna e si revoca solo da qui,
                separatamente dai dati anagrafici e dall’approvazione. Possono
                esistere al massimo 4 amministratori.
              </p>

              {member.is_admin ? (
                isSelf ? (
                  <p className="mt-3 text-sm leading-6 text-sky-900 dark:text-sky-200">
                    Non puoi revocare il tuo stesso ruolo di amministratore. Se
                    serve, chiedi a un altro amministratore.
                  </p>
                ) : (
                  <button
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300 dark:hover:bg-red-950/40"
                    disabled={isSaving}
                    onClick={() => {
                      setAdminError(null);
                      setIsRevokeConfirmOpen(true);
                    }}
                    type="button"
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    Revoca ruolo amministratore
                  </button>
                )
              ) : member.approval_status === "approved" ? (
                <button
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
                  disabled={isPromotingAdmin || isSaving}
                  onClick={handlePromoteAdmin}
                  type="button"
                >
                  {isPromotingAdmin ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                  ) : (
                    <ShieldCheckIcon className="h-4 w-4" />
                  )}
                  {isPromotingAdmin
                    ? "Promozione…"
                    : "Promuovi ad amministratore"}
                </button>
              ) : (
                <p className="mt-3 text-sm leading-6 text-sky-900 dark:text-sky-200">
                  Approva prima l’account per poter assegnare il ruolo di
                  amministratore.
                </p>
              )}

              {adminError ? (
                <div
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  role="alert"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{adminError}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
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
                aria-describedby={`${fieldId}-birth-date-hint`}
                autoComplete="bday"
                className={inputClass}
                disabled={isSaving}
                id={`${fieldId}-birth-date`}
                inputMode="numeric"
                maxLength={10}
                name="birth_date"
                onChange={(event) =>
                  updateField(
                    "birth_date",
                    maskItalianDateInput(event.target.value),
                  )
                }
                placeholder="gg/mm/aaaa"
                type="text"
                value={values.birth_date}
              />
              <p
                className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                id={`${fieldId}-birth-date-hint`}
              >
                Formato gg/mm/aaaa. Esempio: 14/03/1985. Puoi lasciare vuoto se
                non vuoi indicarla.
              </p>
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
                aria-describedby={`${fieldId}-enlistment-year-hint`}
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
              <p
                className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                id={`${fieldId}-enlistment-year-hint`}
              >
                Anno a quattro cifre, tra 1900 e {new Date().getFullYear()}.
                Esempio: 1985.
              </p>
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

        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <DownloadIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Esporta dati del socio
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                Scarica scheda, email, risposte agli eventi, richieste e
                consensi privacy di{" "}
                {member.full_name?.trim() || "questo iscritto"}. Utile per
                rispondere a una richiesta di accesso o portabilità.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  disabled={exportingFormat !== null || isSaving}
                  onClick={() => handleExport("json")}
                  type="button"
                >
                  {exportingFormat === "json" ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                  {exportingFormat === "json"
                    ? "Preparazione…"
                    : "Scarica JSON"}
                </button>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  disabled={exportingFormat !== null || isSaving}
                  onClick={() => handleExport("text")}
                  type="button"
                >
                  {exportingFormat === "text" ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700 dark:border-emerald-800 dark:border-t-emerald-300"
                    />
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                  {exportingFormat === "text"
                    ? "Preparazione…"
                    : "Scarica testo"}
                </button>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:bg-zinc-950 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  disabled={exportingFormat !== null || isSaving}
                  onClick={() => handleExport("html")}
                  type="button"
                >
                  {exportingFormat === "html" ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700 dark:border-emerald-800 dark:border-t-emerald-300"
                    />
                  ) : (
                    <DownloadIcon className="h-4 w-4" />
                  )}
                  {exportingFormat === "html"
                    ? "Preparazione…"
                    : "Scarica HTML"}
                </button>
              </div>

              {exportError ? (
                <div
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  role="alert"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{exportError}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

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

    {isRevokeConfirmOpen ? (
      <RevokeAdminDialog
        displayName={member.full_name?.trim() || "questo iscritto"}
        memberId={member.id}
        onClose={() => setIsRevokeConfirmOpen(false)}
        onRevoked={handleRevoked}
      />
    ) : null}
    </>
  );
}
