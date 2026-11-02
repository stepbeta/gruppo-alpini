"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  deleteAnnouncement,
  formatAnnouncementError,
  type Announcement,
} from "@/lib/announcements";
import { AlertCircleIcon, TrashIcon, XIcon } from "@/components/icons";

type DeleteAnnouncementDialogProps = {
  announcement: Announcement;
  onClose: () => void;
  onDeleted: (announcementId: string) => void;
};

export function DeleteAnnouncementDialog({
  announcement,
  onClose,
  onDeleted,
}: DeleteAnnouncementDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function handleKeyDown(keyboardEvent: globalThis.KeyboardEvent) {
      if (keyboardEvent.key === "Escape" && !isDeleting) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleting, onClose]);

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

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    const { error: deleteError } = await deleteAnnouncement(announcement.id);

    if (deleteError) {
      setError(
        formatAnnouncementError(
          deleteError ?? "Impossibile eliminare l’avviso.",
        ),
      );
      setIsDeleting(false);
      return;
    }

    onDeleted(announcement.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(mouseEvent) => {
        if (!isDeleting && mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-busy={isDeleting}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:bg-zinc-900"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
              <TrashIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
                id={titleId}
              >
                Elimina avviso
              </h2>
              <p
                className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300"
                id={descriptionId}
              >
                L’avviso verrà rimosso dal portale. L’operazione non può essere
                annullata.
              </p>
            </div>
          </div>
          <button
            aria-label="Chiudi"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            disabled={isDeleting}
            onClick={onClose}
            type="button"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <p className="whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {announcement.message}
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
            disabled={isDeleting}
            onClick={onClose}
            ref={cancelButtonRef}
            type="button"
          >
            Annulla
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-600 dark:hover:bg-red-500"
            disabled={isDeleting}
            onClick={handleDelete}
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
            {isDeleting ? "Eliminazione…" : "Elimina avviso"}
          </button>
        </div>
      </div>
    </div>
  );
}
