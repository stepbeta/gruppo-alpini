/**
 * ============================================================================
 * USER FAQ / QUICK HELP — MAINTENANCE RULE
 * ============================================================================
 *
 * Whenever features are added, updated, removed, or navigation paths change in
 * the application, this user FAQ hub must be updated simultaneously in the
 * same pull request to ensure the help links and descriptions remain
 * completely accurate.
 *
 * In pratica: se aggiungi, modifichi o rimuovi una funzione, un’azione o una
 * rotta, aggiorna le domande, le risposte e i collegamenti di questa guida
 * nello stesso pull request. Controlla anche che gli anchor link (`#...`) alle
 * sezioni di /eventi, /richieste, /iscritti e /profile esistano ancora.
 * ============================================================================
 */

import Link from "next/link";
import { Brand } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import {
  ArrowRightIcon,
  CalendarIcon,
  HelpCircleIcon,
  MailIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";

const inlineLinkClass =
  "font-semibold text-emerald-800 underline underline-offset-2 transition hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200";

const actionLinkClass =
  "mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500";

const shortcuts = [
  {
    href: "/eventi",
    title: "Eventi e RSVP",
    description: "Consulta il calendario e aggiorna la tua adesione.",
    icon: CalendarIcon,
  },
  {
    href: "/richieste#nuova-richiesta",
    title: "Richieste alla segreteria",
    description: "Scrivi un messaggio e controlla lo stato delle tue richieste.",
    icon: MailIcon,
  },
  {
    href: "/iscritti#cerca-iscritti",
    title: "Lista iscritti",
    description: "Cerca un socio per nome o luogo di servizio.",
    icon: UsersIcon,
  },
  {
    href: "/profile#dati-personali",
    title: "Profilo e credenziali",
    description: "Aggiorna i tuoi dati, la password e l’indirizzo email.",
    icon: UserIcon,
  },
] as const;

const faqItems = [
  {
    id: "eventi-rsvp",
    question:
      "Come faccio a modificare o revocare la mia prenotazione (RSVP) a un evento?",
    answer: (
      <>
        <p>
          Le adesioni si gestiscono dalla pagina{" "}
          <Link className={inlineLinkClass} href="/eventi">
            Eventi
          </Link>
          . Apri un evento nella sezione <strong>Prossimi eventi</strong> e
          scegli <strong>Presente</strong>, <strong>In forse</strong> o{" "}
          <strong>Assente</strong>.
        </p>
        <ul className="mt-3 space-y-2">
          <li>
            Per modificare una risposta, premi un altro stato: il salvataggio è
            immediato.
          </li>
          <li>
            Per revocare una prenotazione, imposta <strong>Assente</strong>.
          </li>
          <li>
            Gli eventi passati restano consultabili, ma le risposte non sono più
            modificabili.
          </li>
        </ul>
      </>
    ),
    href: "/eventi",
    linkLabel: "Apri Eventi",
  },
  {
    id: "richieste-segreteria",
    question:
      "Dove posso trovare le richieste inviate alla segreteria e come posso crearne una nuova?",
    answer: (
      <>
        <p>
          La pagina{" "}
          <Link className={inlineLinkClass} href="/richieste#nuova-richiesta">
            Richieste
          </Link>{" "}
          contiene tutto: nel riquadro <strong>Nuova richiesta</strong> scrivi
          il messaggio con i dettagli utili e premi <strong>Invia richiesta</strong>.
          Sotto,{" "}
          <Link className={inlineLinkClass} href="/richieste#le-mie-richieste">
            Le tue richieste
          </Link>{" "}
          mostra i messaggi inviati con stato <strong>In attesa</strong> o{" "}
          <strong>Risolta</strong>.
        </p>
        <p className="mt-3">
          La segreteria riceve il messaggio e può aggiornarne lo stato. Dalla
          pagina non è previsto un pulsante per modificare o eliminare una
          richiesta già inviata: se devi correggere qualcosa, inviane una nuova
          indicando il riferimento alla precedente.
        </p>
      </>
    ),
    href: "/richieste",
    linkLabel: "Apri Richieste",
  },
  {
    id: "lista-iscritti",
    question:
      "Come posso cercare altri iscritti o visualizzare i loro dettagli?",
    answer: (
      <>
        <p>
          Apri la{" "}
          <Link className={inlineLinkClass} href="/iscritti#cerca-iscritti">
            Lista iscritti
          </Link>{" "}
          e usa il campo <strong>Cerca per nome o luogo di servizio</strong>. La
          ricerca non distingue maiuscole e minuscole e accetta anche parole
          parziali.
        </p>
        <p className="mt-3">
          Ogni scheda mostra nome, data di nascita, anno di leva e luogo di
          servizio. Questi dettagli sono visibili solo ai soci approvati; la
          modifica delle schede è riservata agli amministratori. Se non trovi
          una persona, prova con il cognome o con una parte del luogo di
          servizio.
        </p>
      </>
    ),
    href: "/iscritti",
    linkLabel: "Apri Lista iscritti",
  },
  {
    id: "profilo-credenziali",
    question:
      "Come posso aggiornare i miei dati personali, la mia password o verificare il mio stato?",
    answer: (
      <>
        <p>
          Apri{" "}
          <Link className={inlineLinkClass} href="/profile#dati-personali">
            Profilo
          </Link>{" "}
          e aggiorna nome, data di nascita, anno di leva e luogo di servizio,
          poi premi <strong>Salva modifiche</strong>.
        </p>
        <p className="mt-3">
          Nella sezione{" "}
          <Link className={inlineLinkClass} href="/profile#sicurezza">
            Sicurezza e credenziali
          </Link>{" "}
          puoi cambiare password o indirizzo email. Se accedi con Google, la
          gestione della password avviene direttamente dal tuo account Google.
        </p>
        <p className="mt-3">
          Se riesci a vedere il portale, il tuo account è approvato. Un account
          in attesa o rifiutato vede invece la schermata di stato con il
          pulsante <strong>Controlla di nuovo</strong>. Dalla pagina Profilo
          puoi anche{" "}
          <Link className={inlineLinkClass} href="/profile#esporta-dati">
            esportare i tuoi dati
          </Link>{" "}
          o eliminare l’account.
        </p>
      </>
    ),
    href: "/profile",
    linkLabel: "Apri Profilo",
  },
  {
    id: "approvazione-privacy",
    question:
      "Cosa significa “account in attesa di approvazione” e come funziona la privacy?",
    answer: (
      <>
        <p>
          Le iscrizioni sono aperte, ma l’accesso è riservato ai soci approvati.
          Ogni nuovo account parte con stato{" "}
          <strong>In attesa di approvazione</strong>: un amministratore verifica
          la richiesta prima di abilitare la lista iscritti, gli eventi e le
          richieste alla segreteria.
        </p>
        <p className="mt-3">
          Durante l’attesa puoi consultare questa guida, esportare i tuoi dati o
          eliminare l’account dalla schermata di stato. Se la richiesta viene
          rifiutata e pensi che sia un errore, contatta gli amministratori del
          gruppo.
        </p>
        <p className="mt-3">
          Prima di usare il portale devi accettare l’
          <Link className={inlineLinkClass} href="/privacy">
            informativa sulla privacy
          </Link>
          . Il consenso viene registrato con la versione dell’informativa; i
          dati dei soci sono visibili solo alle persone autorizzate e puoi
          esercitare i tuoi diritti di accesso, esportazione e cancellazione
          dalle pagine Profilo e Privacy.
        </p>
      </>
    ),
    href: "/privacy",
    linkLabel: "Leggi l’informativa privacy",
  },
];

export function FaqScreen() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
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

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-6 shadow-sm sm:p-8 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-900">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
              <HelpCircleIcon className="h-3.5 w-3.5" />
              Guida rapida
            </span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Risposte pensate per i soci
            </p>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Come possiamo aiutarti?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-300">
            Trova la risposta partendo da ciò che vuoi fare. Ogni sezione
            include il collegamento diretto alla pagina giusta del portale.
          </p>
        </header>

        <section aria-labelledby="faq-shortcuts" className="mt-7">
          <h2
            className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400"
            id="faq-shortcuts"
          >
            Vai subito a
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;

              return (
                <li key={shortcut.href}>
                  <Link
                    className="group flex h-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
                    href={shortcut.href}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {shortcut.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {shortcut.description}
                      </span>
                    </span>
                    <ArrowRightIcon className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="faq-questions" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2
              className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              id="faq-questions"
            >
              Domande frequenti
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Apri una domanda per leggere la risposta.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {faqItems.map((item) => (
              <details
                className="group scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                id={item.id}
                key={item.id}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-zinc-900 transition hover:bg-emerald-50/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600 sm:px-6 dark:text-zinc-50 dark:hover:bg-emerald-950/20 [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition group-open:rotate-90 group-open:bg-emerald-100 group-open:text-emerald-800 dark:bg-zinc-800 dark:text-zinc-400 dark:group-open:bg-emerald-950/60 dark:group-open:text-emerald-300">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </summary>

                <div className="border-t border-zinc-200 px-5 py-5 text-sm leading-6 text-zinc-700 sm:px-6 dark:border-zinc-800 dark:text-zinc-300">
                  {item.answer}
                  <Link className={actionLinkClass} href={item.href}>
                    {item.linkLabel}
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </section>

        <aside className="mt-10 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <MailIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Non hai trovato la risposta?
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Quando il tuo account è approvato, puoi scrivere alla segreteria
              dalla pagina{" "}
              <Link className={inlineLinkClass} href="/richieste#nuova-richiesta">
                Richieste
              </Link>
              . Indica il passaggio che non riesci a completare e, se possibile,
              il nome della pagina o dell’evento.
            </p>
          </div>
        </aside>
      </main>

      <SiteFooter containerClassName="max-w-4xl" />
    </div>
  );
}
