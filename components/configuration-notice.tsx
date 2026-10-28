import { Brand } from "./brand";
import { AlertCircleIcon } from "./icons";

export function ConfigurationNotice() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-lg">
        <Brand />

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <h1 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                Configurazione Supabase mancante
              </h1>
              <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">
                Crea o aggiorna <code className="font-mono">.env.local</code> con
                le credenziali del progetto, poi riavvia il server di sviluppo.
              </p>
            </div>
          </div>

          <pre className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white/70 p-4 font-mono text-xs text-amber-900 dark:border-amber-900 dark:bg-zinc-950/60 dark:text-amber-100">
            {`# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
