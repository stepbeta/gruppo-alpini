"use client";

/**
 * ============================================================================
 * CONTEXTUAL GUIDANCE — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever the administrator lifecycle or its confirmation text changes,
 * update this dialog and the corresponding manual/architecture notes in the
 * same pull request.
 * ============================================================================
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  demoteFromAdmin,
  formatAdminRoleError,
  type Member,
} from "@/lib/profile";
import {
  AlertCircleIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/icons";

type RevokeAdminDialogProps = {
  displayName: string;
  memberId: string;
  onClose: () => void;
  onRevoked: (member: Member) => void;
};

export function RevokeAdminDialog({
  displayName,
  memberId,
  onClose,
  onRevoked,
}: RevokeAdminDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(keyboardEvent: globalThis.KeyboardEvent) {
      if (keyboardEvent.key === "Escape" && !isRevoking) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRevoking, onClose]);

  function handleDialogKeyDown(
    keyboardEvent: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (keyboardEvent.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href]',
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

  async function handleRevoke() {
    if (isRevoking) return;

    setIsRevoking(true);
    setError(null);

    const { member: updatedMember, error: demoteError } =
      await demoteFromAdmin(memberId);

    if (demoteError || !updatedMember) {
      setError(
        formatAdminRoleError(
          demoteError ?? "Impossibile revocare il ruolo. Riprova.",
        ),
      );
      setIsRevoking(false);
      return;
    }

    onRevoked(updatedMember);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/60 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(mouseEvent) => {
        if (!isRevoking && mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-busy={isRevoking}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-zinc-900"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <ShieldCheckIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                id={titleId}
              >
                Revoca ruolo amministratore
              </h2>
              <p
                className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300"
                id={descriptionId}
              >
                {displayName} tornerà un socio approvato senza privilegi di
                amministrazione.
              </p>
            </div>
          </div>
          <button
            aria-label="Chiudi"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            disabled={isRevoking}
            onClick={onClose}
            type="button"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Cosa perderà {displayName}
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-amber-900 marker:text-amber-500 dark:text-amber-200 dark:marker:text-amber-400">
            <li>Approvare o rifiutare gli account in attesa.</li>
            <li>Modificare le schede degli altri soci.</li>
            <li>
              Creare, modificare ed eliminare eventi e modelli evento, e
              consultare tutte le adesioni.
            </li>
            <li>
              Leggere tutte le richieste della segreteria e pubblicare avvisi.
            </li>
            <li>
              Esportare o eliminare gli account di altri soci e accedere al
              manuale amministratore.
            </li>
          </ul>
          <p className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
            Continuerà a usare il portale come socio approvato, con accesso alla
            directory, agli eventi, alle proprie richieste e al proprio profilo.
          </p>
        </div>

        {error ? (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            role="alert"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-end dark:border-zinc-800">
          <button
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            disabled={isRevoking}
            onClick={onClose}
            ref={cancelButtonRef}
            type="button"
          >
            Annulla
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
            disabled={isRevoking}
            onClick={handleRevoke}
            type="button"
          >
            {isRevoking ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : (
              <ShieldCheckIcon className="h-4 w-4" />
            )}
            {isRevoking ? "Revoca in corso…" : "Revoca ruolo amministratore"}
          </button>
        </div>
      </div>
    </div>
  );
}
