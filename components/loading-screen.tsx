import { Brand } from "./brand";

export function LoadingScreen({ message = "Caricamento…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-zinc-950">
      <Brand />
      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-700 dark:border-zinc-700 dark:border-t-emerald-400"
        />
        <span role="status">{message}</span>
      </div>
    </div>
  );
}
