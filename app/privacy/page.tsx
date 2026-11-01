import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Informativa privacy — Gruppo Alpini",
  description:
    "Come il portale del Gruppo Alpini raccoglie, usa e protegge i dati dei soci.",
};

const summaryItems = [
  "I dati servono solo per organizzare la vita del gruppo e le sue attività.",
  "La lista iscritti è visibile esclusivamente ai soci che hanno effettuato l’accesso.",
  "Le tue risposte agli eventi sono visibili a te e agli amministratori del gruppo.",
  "Non vendiamo i dati e non li usiamo per pubblicità o per studiare le tue abitudini.",
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            aria-label="Torna alla home"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
            href="/"
          >
            <Brand compact />
          </Link>
          <Link
            aria-label="Torna al portale"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:px-3 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            href="/"
          >
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Torna al portale</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Pagina pubblica
          </span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ultimo aggiornamento: 1 novembre 2026
          </p>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          Informativa sulla privacy
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          Questa pagina spiega in modo semplice quali dati raccogliamo
          attraverso il portale del Gruppo Alpini, perché li raccogliamo e come
          li proteggiamo. Vale per tutti i soci che creano un account e usano i
          servizi del gruppo.
        </p>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            In breve
          </h2>
          <ul className="mt-4 space-y-3">
            {summaryItems.map((item) => (
              <li className="flex items-start gap-3" key={item}>
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 space-y-9">
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Quali dati raccogliamo
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Quando crei l’account, compili la tua scheda o rispondi a un
              evento, possiamo raccogliere:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 marker:text-emerald-600 dark:text-zinc-300 dark:marker:text-emerald-400">
              <li>nome e cognome;</li>
              <li>indirizzo email collegato all’account;</li>
              <li>data di nascita, se scegli di inserirla;</li>
              <li>anno di leva, se scegli di inserirlo;</li>
              <li>luogo di servizio, se scegli di inserirlo;</li>
              <li>
                la tua risposta di partecipazione agli eventi (presente,
                assente o in forse).
              </li>
            </ul>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Ti chiediamo di inserire solo le informazioni utili alla vita del
              gruppo. Non abbiamo bisogno di dati sanitari, opinioni politiche o
              altre informazioni personali particolari.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Perché usiamo i dati
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Usiamo i dati dei soci per:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 marker:text-emerald-600 dark:text-zinc-300 dark:marker:text-emerald-400">
              <li>tenere aggiornata la lista degli iscritti;</li>
              <li>organizzare attività, eventi e comunicazioni del gruppo;</li>
              <li>
                raccogliere le adesioni agli eventi e aiutare gli organizzatori a
                preparare l’incontro;
              </li>
              <li>permetterti di accedere al portale e gestire la tua scheda.</li>
            </ul>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Non usiamo i dati per pubblicità o per studiare le tue abitudini.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Come funziona l’accesso
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              L’accesso è gestito da Supabase, il servizio che usiamo per
              gestire gli accessi e il database. Puoi entrare con email e
              password oppure con Google.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 marker:text-emerald-600 dark:text-zinc-300 dark:marker:text-emerald-400">
              <li>
                Con email e password, la password è gestita da Supabase e non è
                visibile agli amministratori del gruppo.
              </li>
              <li>
                Con Google, l’accesso è gestito da Google secondo la sua
                informativa. Noi riceviamo solo le informazioni necessarie a
                riconoscere il tuo account, come nome ed email.
              </li>
            </ul>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Non conserviamo la tua password in chiaro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Chi può vedere i dati
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              La lista iscritti è riservata ai soci autenticati. Ogni socio può
              vedere nome, data di nascita, anno di leva e luogo di servizio
              degli altri soci. Gli amministratori possono modificare le schede
              per mantenerle corrette. La lista non è pubblica e non viene
              condivisa con persone esterne al gruppo.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Per gli eventi, ogni socio vede soltanto la propria risposta. Gli
              amministratori vedono le risposte dei soci con nome e stato
              (presente, in forse o assente), compresi i soci che non hanno
              ancora risposto, per organizzare l’incontro. Anche questi dati non
              sono pubblici.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Per far funzionare il portale ci appoggiamo a fornitori tecnici:
              Supabase per database e accesso, Google per l’accesso con Google e
              il nostro servizio di hosting. Questi fornitori trattano i dati
              solo per far funzionare il servizio e non li usano per pubblicità.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Come proteggiamo i dati
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              I dati sono conservati nel database Supabase. L’accesso è protetto
              da regole di sicurezza che limitano lettura e modifica ai soci
              autenticati e agli amministratori. Le comunicazioni con il portale
              viaggiano su collegamenti protetti.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Nessun sistema è sicuro al 100%, ma facciamo attenzione a limitare
              l’accesso ai soli dati necessari.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Per quanto tempo conserviamo i dati
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Conserviamo i dati finché il tuo account è attivo e fai parte del
              gruppo. Puoi eliminare il tuo account dalla pagina Profilo; gli
              amministratori possono eliminare l’account di un socio dalla lista
              iscritti. L’accesso e la scheda personale vengono rimossi, salvo
              eventuali obblighi previsti dalla legge.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Le risposte agli eventi e le richieste già inviate restano
              conservate in forma anonima, senza collegamento al tuo nome o alla
              tua email, per mantenere le statistiche storiche del gruppo. Se un
              evento viene eliminato, vengono rimosse anche le risposte collegate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              I tuoi diritti
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Puoi:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600 marker:text-emerald-600 dark:text-zinc-300 dark:marker:text-emerald-400">
              <li>vedere e aggiornare i tuoi dati dalla pagina Profilo;</li>
              <li>
                vedere e aggiornare la tua risposta a un evento dalla pagina
                Eventi;
              </li>
              <li>chiedere la correzione di dati sbagliati;</li>
              <li>
                eliminare direttamente il tuo account dalla pagina Profilo;
              </li>
              <li>
                chiedere a un amministratore di eliminare l’account di un socio;
              </li>
              <li>chiedere informazioni su come trattiamo i dati.</li>
            </ul>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Per esercitare questi diritti, contatta un amministratore del
              gruppo. Risponderemo il prima possibile.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Cookie e sessione di accesso
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Non usiamo cookie pubblicitari e non raccogliamo dati per
              mostrarti annunci. Per mantenerti collegato, il portale conserva
              la sessione di accesso nel browser. Quando esci, la sessione viene
              cancellata.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Modifiche a questa informativa
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Possiamo aggiornare questa pagina se cambiano le funzioni del
              portale o il modo in cui trattiamo i dati. La data in alto indica
              l’ultima modifica.
            </p>
          </section>
        </div>

        <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
            Hai una domanda?
          </h2>
          <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
            Parla con un amministratore del Gruppo Alpini. Saremo felici di
            spiegarti come usiamo i dati.
          </p>
          <Link
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 underline-offset-4 transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-300"
            href="/"
          >
            Torna al portale
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-zinc-500 sm:flex-row sm:px-6 sm:text-left dark:text-zinc-400">
          <p>Gruppo Alpini · Portale dei soci</p>
          <Link
            className="rounded font-medium transition-colors hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:hover:text-emerald-400"
            href="/"
          >
            Torna al portale
          </Link>
        </div>
      </footer>
    </div>
  );
}
