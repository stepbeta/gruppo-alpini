"use client";

/**
 * ============================================================================
 * MANUALE AMMINISTRATORE — REGOLA DI MANUTENZIONE
 * ============================================================================
 *
 * Whenever features are added, updated, or removed in the codebase, or when
 * database migrations/policies change, this manual page must be updated
 * simultaneously in the same pull request to reflect the current state of the
 * application.
 *
 * In pratica: questo file racconta come funziona il portale per chi lo
 * amministra. Se cambia un pulsante, un flusso, un ruolo, una regola di
 * approvazione o una policy Supabase, aggiorna anche la sezione corrispondente.
 * Aggiorna inoltre `MANUAL_LAST_UPDATED` e, se serve, i file corrispondenti
 * nella cartella `docs/architecture/`.
 * ============================================================================
 */

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  LockIcon,
  MailIcon,
  MegaphoneIcon,
  PencilIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@/components/icons";

/** Update this date whenever the manual changes. */
const MANUAL_LAST_UPDATED = "7 novembre 2026";

type ManualIcon = ComponentType<{ className?: string }>;

type ManualSectionId =
  | "panoramica"
  | "iscritti"
  | "eventi"
  | "segreteria"
  | "avvisi"
  | "privacy";

type ManualSectionProps = {
  id: ManualSectionId;
  title: string;
  description: string;
  icon: ManualIcon;
  isHidden?: boolean;
  children: ReactNode;
};

const MANUAL_SECTIONS: Array<{
  id: ManualSectionId;
  title: string;
  summary: string;
  icon: ManualIcon;
}> = [
  {
    id: "panoramica",
    title: "Panoramica e ruoli",
    summary: "Chi può fare cosa e come funziona l’iscrizione.",
    icon: UsersIcon,
  },
  {
    id: "iscritti",
    title: "Iscritti e approvazioni",
    summary: "Approvare account, correggere schede, esportare o eliminare.",
    icon: ShieldCheckIcon,
  },
  {
    id: "eventi",
    title: "Eventi e adesioni",
    summary: "Creare eventi, leggere le presenze e usare i modelli.",
    icon: CalendarIcon,
  },
  {
    id: "segreteria",
    title: "Segreteria",
    summary: "Seguire le richieste dei soci e cambiarne lo stato.",
    icon: MailIcon,
  },
  {
    id: "avvisi",
    title: "Avvisi",
    summary: "Pubblicare e programmare messaggi per tutti i soci.",
    icon: MegaphoneIcon,
  },
  {
    id: "privacy",
    title: "Privacy e dati",
    summary: "Consensi, esportazioni e cancellazione degli account.",
    icon: LockIcon,
  },
];

const ROLE_STYLES = {
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  danger:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  admin:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
} as const;

const ROLES: Array<{
  name: string;
  label: string;
  description: string;
  tone: keyof typeof ROLE_STYLES;
}> = [
  {
    name: "Visitatore",
    label: "Non autenticato",
    description:
      "Può vedere solo le pagine di accesso e l’informativa privacy. Non vede dati dei soci.",
    tone: "neutral",
  },
  {
    name: "Account senza consenso",
    label: "Da completare",
    description:
      "Ha creato un account ma non ha ancora accettato l’informativa privacy. Deve accettarla prima di usare il portale.",
    tone: "warning",
  },
  {
    name: "Account in attesa o rifiutato",
    label: "Bloccato",
    description:
      "Non può entrare nell’area soci. Può esportare i propri dati, eliminare il proprio account o uscire. Un amministratore può approvarlo in seguito.",
    tone: "danger",
  },
  {
    name: "Socio approvato",
    label: "Attivo",
    description:
      "Usa pagina iniziale, elenco iscritti, eventi e adesioni, richieste alla segreteria e profilo personale.",
    tone: "success",
  },
  {
    name: "Amministratore",
    label: "Accesso completo",
    description:
      "Ha tutte le funzioni dei soci e in più gestisce approvazioni, iscritti, eventi, modelli, richieste e avvisi.",
    tone: "admin",
  },
];

function ManualSection({
  id,
  title,
  description,
  icon: Icon,
  isHidden = false,
  children,
}: ManualSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-zinc-900"
      hidden={isHidden}
      id={id}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2
            className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50"
            id={`${id}-title`}
          >
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-5 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function ManualNote({
  title,
  tone = "info",
  children,
}: {
  title: string;
  tone?: "info" | "warning" | "danger";
  children: ReactNode;
}) {
  const styles =
    tone === "danger"
      ? {
          box: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
          title: "text-red-900 dark:text-red-100",
          text: "text-red-800 dark:text-red-200",
          icon: "text-red-700 dark:text-red-300",
        }
      : tone === "warning"
        ? {
            box: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
            title: "text-amber-900 dark:text-amber-100",
            text: "text-amber-800 dark:text-amber-200",
            icon: "text-amber-700 dark:text-amber-300",
          }
        : {
            box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
            title: "text-emerald-900 dark:text-emerald-100",
            text: "text-emerald-800 dark:text-emerald-200",
            icon: "text-emerald-700 dark:text-emerald-300",
          };
  const Icon = tone === "info" ? CheckCircleIcon : AlertCircleIcon;

  return (
    <div className={`rounded-2xl border p-4 ${styles.box}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} />
        <div>
          <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
          <div className={`mt-1 text-sm leading-6 ${styles.text}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li className="flex items-start gap-2.5" key={index}>
          <CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
      {children}
    </h3>
  );
}

export function AdminManual() {
  const { isAdmin } = useAuth();
  const [viewMode, setViewMode] = useState<"single" | "all">("single");
  const [activeSectionId, setActiveSectionId] =
    useState<ManualSectionId>("panoramica");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldScrollToContent = useRef(false);

  const activeSectionIndex = MANUAL_SECTIONS.findIndex(
    (section) => section.id === activeSectionId,
  );
  const hasPreviousSection = activeSectionIndex > 0;
  const hasNextSection =
    activeSectionIndex >= 0 && activeSectionIndex < MANUAL_SECTIONS.length - 1;

  useEffect(() => {
    if (!shouldScrollToContent.current) return;
    shouldScrollToContent.current = false;
    contentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeSectionId]);

  useEffect(() => {
    if (viewMode !== "all") return;

    const handleScroll = () => setShowBackToTop(window.scrollY > 320);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [viewMode]);

  function isSectionHidden(id: ManualSectionId) {
    return viewMode === "single" && activeSectionId !== id;
  }

  function scrollToIndex() {
    document.getElementById("manual-index")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function selectSection(id: ManualSectionId) {
    if (viewMode === "all") {
      setActiveSectionId(id);
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    setActiveSectionId(id);
  }

  function openSection(id: ManualSectionId) {
    if (viewMode === "all") {
      selectSection(id);
      return;
    }

    if (id === activeSectionId) {
      contentRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    shouldScrollToContent.current = true;
    setActiveSectionId(id);
  }

  function goToAdjacentSection(offset: number) {
    const nextSection = MANUAL_SECTIONS[activeSectionIndex + offset];
    if (!nextSection) return;

    shouldScrollToContent.current = true;
    setActiveSectionId(nextSection.id);
  }

  function toggleViewMode() {
    const nextMode = viewMode === "all" ? "single" : "all";
    setViewMode(nextMode);
    setShowBackToTop(nextMode === "all" && window.scrollY > 320);
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <ShieldCheckIcon className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Accesso riservato
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Il manuale amministratore è disponibile solo per gli
              amministratori del Gruppo Alpini.
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              href="/"
            >
              Torna alla pagina iniziale
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm sm:p-8 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-sky-950/30">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-zinc-950/60 dark:text-emerald-300">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              Solo amministratori
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Aggiornato al {MANUAL_LAST_UPDATED}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            Manuale amministratore
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-300">
            Questa guida raccoglie le funzioni riservate agli amministratori del
            portale. Non serve essere esperti di informatica: ogni sezione
            spiega cosa fare, in quale pagina e con quale risultato.
          </p>
        </div>

        <section
          aria-labelledby="manual-index-title"
          className="mt-6 scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 dark:border-zinc-800 dark:bg-zinc-900"
          id="manual-index"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
              id="manual-index-title"
            >
              <BookOpenIcon className="h-4 w-4" />
              Sezioni del manuale
            </p>
            <button
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "all"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                  : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-300 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:text-emerald-200"
              }`}
              onClick={toggleViewMode}
              type="button"
            >
              {viewMode === "all" ? "Mostra una sezione" : "Mostra tutto"}
            </button>
          </div>

          <nav
            aria-label="Sezioni del manuale"
            className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {MANUAL_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive =
                viewMode === "single" && section.id === activeSectionId;

              return (
                <button
                  aria-controls={section.id}
                  aria-pressed={isActive}
                  className={`group flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-100"
                  }`}
                  key={section.id}
                  onClick={() => selectSection(section.id)}
                  title={`${section.title} — ${section.summary}`}
                  type="button"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-emerald-950/60 dark:group-hover:text-emerald-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 truncate">{section.title}</span>
                </button>
              );
            })}
          </nav>

          <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {viewMode === "all"
              ? "Vista completa: tutte le sezioni sono aperte. Usa il pulsante “Torna su” mentre scorri."
              : "Stai leggendo una sezione alla volta. Scegli un’altra sezione qui sopra oppure usa “Mostra tutto” per il manuale completo."}
          </p>
        </section>

        <div className="mt-8 space-y-6 scroll-mt-24" ref={contentRef}>
          <ManualSection
            description="Le regole di base che valgono per tutte le pagine del portale."
            icon={UsersIcon}
            id="panoramica"
            isHidden={isSectionHidden("panoramica")}
            title="Panoramica e modello di funzionamento"
          >
            <p>
              Il portale è uno spazio privato per i soci del Gruppo Alpini. Ogni
              persona vede solo ciò che il proprio ruolo consente. I permessi
              non dipendono dal fatto che un pulsante sia visibile: sono
              controllati anche dal database, quindi non possono essere aggirati
              modificando una pagina.
            </p>

            <div>
              <SectionHeading>I ruoli del portale</SectionHeading>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <article
                    className={`rounded-2xl border p-4 ${ROLE_STYLES[role.tone]}`}
                    key={role.name}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">{role.name}</h4>
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold">
                        {role.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6">{role.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <SectionHeading>Come funziona l’iscrizione chiusa</SectionHeading>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>La persona crea un account con email e password oppure con Google.</li>
                <li>Se usa email e password, conferma l’indirizzo email.</li>
                <li>Accetta l’informativa privacy: senza consenso non può usare il portale.</li>
                <li>
                  L’account entra nello stato <strong>In attesa di approvazione</strong>.
                  Da quel momento vede solo la schermata di attesa.
                </li>
                <li>
                  Un amministratore apre <strong>Iscritti</strong>, controlla la
                  richiesta e sceglie <strong>Approva iscritto</strong> oppure{" "}
                  <strong>Rifiuta richiesta</strong>.
                </li>
                <li>
                  Solo dopo l’approvazione il socio può entrare nell’area soci.
                  Un account rifiutato può essere approvato in un secondo momento.
                </li>
              </ol>
            </div>

            <ManualNote title="Il tuo ruolo di amministratore">
              Gli amministratori non sono esentati dal consenso privacy. Per
              l’approvazione, il database considera sempre approvato un
              amministratore: così un errore nello stato dell’account non può
              bloccare la gestione del gruppo.
            </ManualNote>

            <div>
              <SectionHeading>Cosa gestisci come amministratore</SectionHeading>
              <ManualList
                items={[
                  "Approvare o rifiutare nuovi account e correggere le schede dei soci.",
                  "Creare, modificare ed eliminare eventi e modelli evento.",
                  "Leggere le adesioni agli eventi e i nominativi dei soci.",
                  "Seguire le richieste inviate alla segreteria e cambiarne lo stato.",
                  "Pubblicare, programmare, disattivare o eliminare gli avvisi.",
                  "Esportare i dati di un socio o eliminare un account, nel rispetto della privacy.",
                ]}
              />
            </div>
          </ManualSection>

          <ManualSection
            description="Approvazioni, correzioni delle schede e gestione degli account."
            icon={ShieldCheckIcon}
            id="iscritti"
            isHidden={isSectionHidden("iscritti")}
            title="Iscritti e approvazioni"
          >
            <p>
              La pagina <strong>Iscritti</strong> è l’elenco dei soci. Gli
              amministratori vedono anche gli account in attesa e quelli
              rifiutati, oltre ai soci già approvati.
            </p>

            <div>
              <SectionHeading>Approvare o rifiutare una richiesta</SectionHeading>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Apri <strong>Iscritti</strong> dal menu in alto.</li>
                <li>
                  Usa il filtro <strong>In attesa</strong> oppure il contatore
                  delle richieste da esaminare.
                </li>
                <li>Cerca la persona per nome o luogo di servizio, se necessario.</li>
                <li>Premi <strong>Modifica</strong> sulla scheda interessata.</li>
                <li>
                  Controlla i dati e premi <strong>Approva iscritto</strong> o{" "}
                  <strong>Rifiuta richiesta</strong>.
                </li>
                <li>
                  Per riaprire una richiesta già rifiutata, usa{" "}
                  <strong>Approva iscritto</strong> nella stessa scheda.
                </li>
              </ol>
            </div>

            <ManualNote title="Non puoi modificare la tua stessa approvazione" tone="warning">
              La scheda del tuo account non mostra i pulsanti di approvazione.
              È una protezione voluta: evita che un amministratore possa
              sbloccarsi o bloccarsi da solo per errore.
            </ManualNote>

            <div>
              <SectionHeading>Correggere i dati di un socio</SectionHeading>
              <p className="mt-2">
                Dalla scheda di modifica puoi aggiornare nome e cognome, data di
                nascita, anno di leva e luogo di servizio. Inserisci la data di
                nascita nel formato <strong>gg/mm/aaaa</strong>, ad esempio
                14/03/1985, oppure lascia il campo vuoto. Premi{" "}
                <strong>Salva modifiche</strong> per confermare. La modifica dei
                dati anagrafici è separata dall’approvazione dell’account.
              </p>
            </div>

            <div>
              <SectionHeading>Esportare i dati di un socio</SectionHeading>
              <p className="mt-2">
                Nella stessa scheda trovi <strong>Esporta dati del socio</strong>.
                Puoi scaricare la scheda, l’email, le risposte agli eventi, le
                richieste e lo storico dei consensi in tre formati:
              </p>
              <ManualList
                items={[
                  "JSON: adatto al trasferimento verso un altro servizio.",
                  "Testo: leggibile con qualsiasi programma.",
                  "HTML: pronto per la stampa o per l’invio via email.",
                ]}
              />
            </div>

            <div>
              <SectionHeading>Eliminare un account</SectionHeading>
              <p className="mt-2">
                Nella scheda del socio scegli <strong>Elimina account</strong> e
                digita <strong>ELIMINA</strong> nella conferma. L’operazione
                rimuove l’accesso e la scheda personale e non può essere
                annullata.
              </p>
              <p className="mt-2">
                Lo storico del gruppo resta conservato in forma anonima: le
                risposte agli eventi, le richieste e gli eventi già creati non
                vengono cancellati. Ne parliamo anche nella sezione{" "}
                <button
                  className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                  onClick={() => openSection("privacy")}
                  type="button"
                >
                  Privacy e dati
                </button>
                .
              </p>
            </div>
          </ManualSection>

          <ManualSection
            description="Calendario, presenze e modelli riutilizzabili."
            icon={CalendarIcon}
            id="eventi"
            isHidden={isSectionHidden("eventi")}
            title="Eventi e adesioni"
          >
            <p>
              La pagina <strong>Eventi</strong> mostra gli appuntamenti futuri e
              quelli passati. Usa i filtri <strong>Tutti</strong>,{" "}
              <strong>Prossimi</strong> e <strong>Passati</strong> per
              concentrarti su una sola vista; all’apertura è attivo{" "}
              <strong>Prossimi</strong>. Ricerca, paginazione e stato dei due
              elenchi restano indipendenti. I soci possono rispondere solo agli
              eventi futuri.
            </p>

            <div>
              <SectionHeading>Creare un evento</SectionHeading>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Apri <strong>Eventi</strong> e premi <strong>Nuovo evento</strong>.</li>
                <li>Inserisci il titolo, obbligatorio.</li>
                <li>Inserisci la data nel formato <strong>gg/mm/aaaa</strong>, ad esempio 25/12/2026: il campo aggiunge le barre mentre digiti.</li>
                <li>
                  Se l’evento ha un orario, inseriscilo nel formato{" "}
                  <strong>HH:mm</strong> (24 ore), ad esempio 19:00. Se lo lasci
                  vuoto, l’evento è considerato di tutta la giornata.
                </li>
                <li>Aggiungi luogo e descrizione se servono.</li>
                <li>Premi <strong>Crea evento</strong>.</li>
              </ol>
            </div>

            <ManualNote title="Tutta la giornata o con orario?">
              Un evento senza ora viene salvato come evento di tutta la giornata
              e mostra solo la data. Un evento con ora mostra data e ora nel
              fuso orario del dispositivo del socio.
            </ManualNote>

            <div>
              <SectionHeading>Modificare, eliminare e condividere</SectionHeading>
              <ManualList
                items={[
                  "Modifica: cambia i dettagli dell’evento senza toccare le risposte già ricevute.",
                  "Elimina: chiede conferma e cancella anche tutte le adesioni collegate. L’operazione non si può annullare.",
                  "Condividi: crea un link diretto all’evento. Il link resta protetto: chi non ha effettuato l’accesso viene portato al login e poi riportato all’evento.",
                ]}
              />
            </div>

            <div>
              <SectionHeading>Leggere le adesioni</SectionHeading>
              <p className="mt-2">
                Ogni scheda evento mostra i totali e i nomi dei soci divisi tra{" "}
                <strong>Presente</strong>, <strong>In forse</strong> e{" "}
                <strong>Assente</strong>. Se un socio è stato eliminato, compare
                come <strong>Socio eliminato</strong>: il dato storico resta
                valido. Nelle schede eventi puoi anche vedere quanti soci
                approvati non hanno ancora risposto.
              </p>
            </div>

            <div>
              <SectionHeading>Modelli evento</SectionHeading>
              <p className="mt-2">
                I modelli servono a non riscrivere ogni volta gli stessi dettagli.
                Puoi aprirli da <strong>Modelli evento</strong>, nella pagina
                Eventi, oppure dal pulsante <strong>Gestisci modelli</strong>{" "}
                dentro la creazione di un evento.
              </p>
              <ManualList
                items={[
                  "Crea un modello con titolo, descrizione, luogo, tutta la giornata o un orario predefinito.",
                  "Un modello di tutta la giornata non ha orario; un modello con orario deve avere un’ora valida.",
                  "Seleziona un modello durante la creazione di un evento: titolo, luogo, descrizione e ora vengono compilati automaticamente.",
                  "La data non viene mai salvata nel modello: la scegli ogni volta.",
                  "Dalla modifica di un evento esistente puoi usare Salva come modello per catturare i dettagli attuali.",
                  "Modificare o eliminare un modello non cambia gli eventi già creati.",
                ]}
              />
            </div>
          </ManualSection>

          <ManualSection
            description="Richieste inviate dai soci e stato di lavorazione."
            icon={MailIcon}
            id="segreteria"
            isHidden={isSectionHidden("segreteria")}
            title="Segreteria e richieste"
          >
            <p>
              I soci possono inviare una comunicazione alla segreteria dalla
              pagina <strong>Richieste</strong>. Ogni socio vede solo le proprie
              richieste; gli amministratori vedono l’intero elenco.
            </p>

            <div>
              <SectionHeading>Orientarsi nel tabellone</SectionHeading>
              <ManualList
                items={[
                  "Il riepilogo mostra quante richieste sono aperte e quante sono risolte.",
                  "I filtri Tutte, In attesa e Risolte restringono l’elenco.",
                  "La ricerca controlla il testo delle richieste.",
                  "L’elenco è diviso in pagine per restare leggibile.",
                ]}
              />
            </div>

            <div>
              <SectionHeading>Gestire una richiesta</SectionHeading>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Apri la scheda della richiesta.</li>
                <li>Leggi il messaggio e il nome del socio che ha inviato.</li>
                <li>
                  Premi <strong>Segna come risolta</strong> quando il problema è
                  stato gestito.
                </li>
                <li>
                  Se serve riaprirla, premi <strong>Riapri richiesta</strong>.
                </li>
              </ol>
            </div>

            <ManualNote title="Puoi cambiare solo lo stato" tone="warning">
              Il testo e il proprietario di una richiesta non sono modificabili
              dal portale. L’amministratore può solo passare una richiesta da{" "}
              <strong>In attesa</strong> a <strong>Risolta</strong> e viceversa.
            </ManualNote>
          </ManualSection>

          <ManualSection
            description="Messaggi mostrati in cima alle pagine del portale."
            icon={MegaphoneIcon}
            id="avvisi"
            isHidden={isSectionHidden("avvisi")}
            title="Avvisi del portale"
          >
            <p>
              Gli avvisi compaiono nella fascia in alto di tutte le pagine
              dell’area soci. Sono utili per comunicazioni brevi e temporanee,
              non per messaggi lunghi o permanenti.
            </p>

            <div>
              <SectionHeading>Creare un avviso</SectionHeading>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>
                  Apri <strong>Avvisi</strong>: trovi il collegamento nella
                  scheda “Avvisi del portale” della pagina iniziale.
                </li>
                <li>Premi <strong>Nuovo avviso</strong>.</li>
                <li>Scrivi il testo del messaggio.</li>
                <li>
                  Se serve, imposta una data e un’ora di inizio e di fine. Usa{" "}
                  <strong>gg/mm/aaaa</strong> per la data e <strong>HH:mm</strong>{" "}
                  (24 ore) per l’ora. Se imposti un limite devi compilare sia la
                  data sia l’ora; se lasci vuoti entrambi i campi, l’avviso non
                  ha limiti di tempo.
                </li>
                <li>
                  Lascia attiva l’opzione <strong>Avviso attivo</strong> per
                  mostrarlo subito.
                </li>
                <li>Premi <strong>Crea avviso</strong>.</li>
              </ol>
            </div>

            <ManualNote title="Un solo avviso alla volta">
              In cima alle pagine viene mostrato un solo avviso: il più recente
              tra quelli attivi e nel periodo di validità. Gli altri restano
              nell’elenco di gestione e possono essere attivati in seguito.
            </ManualNote>

            <div>
              <SectionHeading>Filtrare gli avvisi</SectionHeading>
              <ManualList
                items={[
                  "Tutti: mostra l’intero elenco, compresi gli avvisi in programma e quelli disattivati.",
                  "Attivi: mostra solo gli avvisi visibili in questo momento, cioè accesi e dentro la finestra di pubblicazione.",
                  "Passati: raccoglie gli avvisi la cui finestra di pubblicazione è già terminata, anche se l’interruttore è ancora acceso.",
                ]}
              />
              <p className="mt-2">
                Ogni scheda riporta la data di creazione e, separatamente, la
                data e l’ora di inizio e fine della pubblicazione. Se un limite
                manca, l’avviso non ha quel vincolo.
              </p>
            </div>

            <div>
              <SectionHeading>Stati dell’avviso</SectionHeading>
              <ManualList
                items={[
                  "Attivo: è pubblicato e visibile in questo momento.",
                  "In programma: inizierà più tardi, secondo la data di inizio.",
                  "Scaduto: la data di fine è già passata. Se l’interruttore è ancora acceso, aggiorna la data di fine per ripubblicarlo.",
                  "Disattivato: è stato spento manualmente e non viene mostrato.",
                ]}
              />
            </div>

            <div>
              <SectionHeading>Modificare, spegnere o eliminare</SectionHeading>
              <p className="mt-2">
                Puoi modificare testo e date, attivare o disattivare un avviso
                con il pulsante di accensione, oppure eliminarlo dopo conferma.
                Le modifiche sono visibili subito nel portale, senza ricaricare
                la pagina.
              </p>
            </div>
          </ManualSection>

          <ManualSection
            description="Consensi, esportazioni e cancellazione degli account."
            icon={LockIcon}
            id="privacy"
            isHidden={isSectionHidden("privacy")}
            title="Privacy e dati"
          >
            <p>
              Il portale tratta dati personali dei soci. Le regole di privacy
              non sono un’opzione: fanno parte del funzionamento del portale e
              vengono applicate anche al database.
            </p>

            <div>
              <SectionHeading>Consenso privacy versionato</SectionHeading>
              <p className="mt-2">
                Ogni socio deve accettare l’informativa privacy prima di usare
                l’area soci. Il consenso viene registrato con data e versione
                dell’informativa. La versione attuale è{" "}
                <strong>{PRIVACY_POLICY_VERSION}</strong>.
              </p>
              <p className="mt-2">
                Quando l’informativa cambia, la versione viene aggiornata e ai
                soci viene chiesto di accettarla di nuovo. Lo storico resta
                separato: non viene sovrascritto.
              </p>
            </div>

            <div>
              <SectionHeading>Esportare i dati</SectionHeading>
              <p className="mt-2">
                Ogni socio può scaricare i propri dati dal profilo. Gli
                amministratori possono esportare i dati di un altro socio dalla
                scheda di modifica in <strong>Iscritti</strong>. L’esportazione
                contiene scheda personale, email, risposte agli eventi, richieste
                e storico dei consensi, nei formati JSON, testo e HTML.
              </p>
            </div>

            <div>
              <SectionHeading>Eliminare un account</SectionHeading>
              <p className="mt-2">
                L’eliminazione richiede la digitazione di <strong>ELIMINA</strong>{" "}
                e non può essere annullata. Vengono rimossi l’accesso e la scheda
                personale. Le risposte agli eventi, le richieste, gli eventi e i
                modelli creati restano invece conservati senza il nome del socio.
                Nell’elenco compaiono come <strong>Socio eliminato</strong>.
              </p>
            </div>

            <ManualNote title="Che cosa significa ON DELETE SET NULL" tone="warning">
              È il nome tecnico della regola con cui il database conserva i
              collegamenti storici: quando un profilo viene eliminato, i dati che
              lo citano non vengono cancellati ma perdono il riferimento alla
              persona. Per questo lo storico delle presenze e delle richieste
              resta valido, ma non è più riconducibile a un socio.
            </ManualNote>

            <ManualNote title="Consensi e cancellazione">
              Lo storico dei consensi privacy viene eliminato insieme
              all’account, come descritto nell’informativa. Se devi conservarne
              una copia per una richiesta di accesso, esporta prima i dati del
              socio.
            </ManualNote>
          </ManualSection>
        </div>

        {viewMode === "single" ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <button
              aria-label="Vai alla sezione precedente"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 sm:flex-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-200 dark:disabled:hover:border-zinc-700 dark:disabled:hover:text-zinc-200"
              disabled={!hasPreviousSection}
              onClick={() => goToAdjacentSection(-1)}
              type="button"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Precedente
            </button>
            <button
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 hover:text-emerald-800 sm:flex-none dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
              onClick={scrollToIndex}
              type="button"
            >
              Torna all’indice
            </button>
            <button
              aria-label="Vai alla sezione successiva"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-300 disabled:hover:text-zinc-700 sm:flex-none dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:border-emerald-800 dark:hover:text-emerald-200 dark:disabled:hover:border-zinc-700 dark:disabled:hover:text-zinc-200"
              disabled={!hasNextSection}
              onClick={() => goToAdjacentSection(1)}
              type="button"
            >
              Successiva
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <aside
          aria-labelledby="maintenance-title"
          className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 dark:border-amber-900 dark:bg-amber-950/30"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <PencilIcon className="h-5 w-5" />
            </span>
            <div>
              <h2
                className="text-base font-semibold text-amber-950 dark:text-amber-100"
                id="maintenance-title"
              >
                Nota per chi sviluppa o modifica il portale
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-200">
                Ogni volta che una funzione viene aggiunta, modificata o rimossa,
                oppure quando cambiano le migrazioni o le policy del database,
                questa pagina deve essere aggiornata nello stesso pull request.
                Il manuale deve descrivere il portale così com’è, non come era in
                passato.
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-200">
                Aggiorna anche la data di “ultimo aggiornamento” in cima a questa
                pagina e, se il cambiamento riguarda architettura, sicurezza o
                dati, i file corrispondenti nella cartella <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-950/60">docs/architecture/</code>.
              </p>
            </div>
          </div>
        </aside>
      </main>

      <SiteFooter />

      {viewMode === "all" && showBackToTop ? (
        <button
          aria-label="Torna all’inizio del manuale"
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:bottom-6 sm:right-6 dark:border-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          type="button"
        >
          <ArrowUpIcon className="h-4 w-4" />
          Torna su
        </button>
      ) : null}
    </div>
  );
}
