"use client";

import { supabase } from "./supabase";

export type ExportFormat = "json" | "text" | "html";

export type UserDataExport = {
  export_version: string;
  generated_at: string;
  user: {
    id: string;
    email: string | null;
    created_at: string | null;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
  };
  profile: {
    full_name: string | null;
    birth_date: string | null;
    enlistment_year: number | null;
    service_place: string | null;
    is_admin: boolean | null;
    updated_at: string | null;
  } | null;
  event_responses: Array<{
    event_id: string;
    event_title: string;
    event_date: string;
    is_all_day: boolean;
    location: string | null;
    status: string;
    status_label: string;
    response_updated_at: string;
  }>;
  generic_requests: Array<{
    id: string;
    message: string;
    created_at: string;
    status: string;
    status_label: string;
  }>;
  privacy_consents: Array<{
    policy_version: string;
    accepted_at: string;
  }>;
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  present: "Presente",
  tentative: "In forse",
  absent: "Assente",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "In attesa",
  resolved: "Risolta",
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeZone: "Europe/Rome",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

/**
 * Validates the shape returned by the `export_user_data` RPC before the UI
 * relies on it. The type assertion is safe because every top-level section and
 * its required container is checked above.
 */
function parseUserDataExport(value: unknown): UserDataExport | null {
  if (!isRecord(value)) return null;
  if (typeof value.export_version !== "string") return null;
  if (typeof value.generated_at !== "string") return null;
  if (!isRecord(value.user) || typeof value.user.id !== "string") return null;
  if (!("profile" in value)) return null;
  if (value.profile !== null && !isRecord(value.profile)) return null;
  if (!isRecordArray(value.event_responses)) return null;
  if (!isRecordArray(value.generic_requests)) return null;
  if (!isRecordArray(value.privacy_consents)) return null;

  return value as unknown as UserDataExport;
}

/** Turns the most common export/PostgREST errors into Italian messages. */
export function formatExportError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("pgrst202") ||
    normalized.includes("42883") ||
    normalized.includes("could not find the function") ||
    normalized.includes("does not exist")
  ) {
    return "La funzione di esportazione non è ancora disponibile. Applica le migrazioni Supabase con npm run db:push.";
  }

  if (
    normalized.includes("permission denied") ||
    normalized.includes("42501") ||
    normalized.includes("non hai i permessi")
  ) {
    return "Non hai i permessi per esportare questi dati.";
  }

  if (
    normalized.includes("utente non trovato") ||
    normalized.includes("p0002") ||
    normalized.includes("sessione mancante")
  ) {
    return "Utente non trovato o sessione scaduta. Accedi di nuovo e riprova.";
  }

  return "Impossibile esportare i dati. Riprova o contatta un amministratore.";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Errore di rete. Controlla la connessione e riprova.";
}

/**
 * Fetches the GDPR export for the signed-in member or, when called by an
 * administrator, for another member. Authorization is enforced inside the
 * SECURITY DEFINER SQL function, so the browser never needs the service key.
 */
export async function fetchUserDataExport(targetUserId: string): Promise<{
  data: UserDataExport | null;
  error: string | null;
}> {
  if (!supabase) {
    return { data: null, error: "Supabase non configurato." };
  }

  try {
    const { data, error } = await supabase.rpc("export_user_data", {
      target_user_id: targetUserId,
    });

    if (error) {
      return { data: null, error: formatExportError(error.message) };
    }

    const parsed = parseUserDataExport(data);

    if (!parsed) {
      return {
        data: null,
        error:
          "Il formato dei dati esportati non è valido. Contatta un amministratore.",
      };
    }

    return { data: parsed, error: null };
  } catch (error) {
    return { data: null, error: formatExportError(errorMessage(error)) };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Non indicato";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Non indicato";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return dateFormatter.format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Non indicato";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return dateTimeFormatter.format(date);
}

function tableRow(label: string, value: string): string {
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function emptyRow(message: string, columns: number): string {
  return `<tr><td class="empty" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function renderAccountSection(data: UserDataExport): string {
  return `
    <section>
      <h2>Account e autenticazione</h2>
      <table>
        <tbody>
          ${tableRow("ID utente", displayText(data.user.id))}
          ${tableRow("Email", displayText(data.user.email))}
          ${tableRow("Account creato il", formatDateTime(data.user.created_at))}
          ${tableRow("Email confermata il", formatDateTime(data.user.email_confirmed_at))}
          ${tableRow("Ultimo accesso", formatDateTime(data.user.last_sign_in_at))}
        </tbody>
      </table>
    </section>
  `;
}

function renderProfileSection(profile: UserDataExport["profile"]): string {
  if (!profile) {
    return `
      <section>
        <h2>Scheda personale</h2>
        <p class="empty">Nessuna scheda personale associata all’account.</p>
      </section>
    `;
  }

  return `
    <section>
      <h2>Scheda personale</h2>
      <table>
        <tbody>
          ${tableRow("Nome completo", displayText(profile.full_name))}
          ${tableRow("Data di nascita", formatDate(profile.birth_date))}
          ${tableRow(
            "Anno di leva",
            profile.enlistment_year === null
              ? "Non indicato"
              : String(profile.enlistment_year),
          )}
          ${tableRow("Luogo di servizio", displayText(profile.service_place))}
          ${tableRow("Amministratore", profile.is_admin ? "Sì" : "No")}
          ${tableRow("Ultimo aggiornamento", formatDateTime(profile.updated_at))}
        </tbody>
      </table>
    </section>
  `;
}

function renderEventResponses(
  rows: UserDataExport["event_responses"],
): string {
  const body =
    rows.length === 0
      ? emptyRow("Nessuna risposta agli eventi.", 4)
      : rows
          .map((row) => {
            const date = row.is_all_day
              ? formatDate(row.event_date)
              : formatDateTime(row.event_date);

            return `<tr>
              <td>${escapeHtml(displayText(row.event_title))}</td>
              <td>${escapeHtml(date)}</td>
              <td>${escapeHtml(displayText(row.location))}</td>
              <td>${escapeHtml(
                displayText(
                  row.status_label ||
                    EVENT_STATUS_LABELS[row.status] ||
                    row.status,
                ),
              )}</td>
            </tr>`;
          })
          .join("");

  return `
    <section>
      <h2>Risposte agli eventi</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Evento</th>
            <th scope="col">Data</th>
            <th scope="col">Luogo</th>
            <th scope="col">Risposta</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function renderGenericRequests(
  rows: UserDataExport["generic_requests"],
): string {
  const body =
    rows.length === 0
      ? emptyRow("Nessuna richiesta inviata.", 3)
      : rows
          .map(
            (row) => `<tr>
              <td>${escapeHtml(formatDateTime(row.created_at))}</td>
              <td class="message">${escapeHtml(displayText(row.message))}</td>
              <td>${escapeHtml(
                displayText(
                  row.status_label ||
                    REQUEST_STATUS_LABELS[row.status] ||
                    row.status,
                ),
              )}</td>
            </tr>`,
          )
          .join("");

  return `
    <section>
      <h2>Richieste alla segreteria</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Inviata il</th>
            <th scope="col">Messaggio</th>
            <th scope="col">Stato</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function renderConsents(rows: UserDataExport["privacy_consents"]): string {
  const body =
    rows.length === 0
      ? emptyRow("Nessun consenso registrato.", 2)
      : rows
          .map(
            (row) => `<tr>
              <td>${escapeHtml(displayText(row.policy_version))}</td>
              <td>${escapeHtml(formatDateTime(row.accepted_at))}</td>
            </tr>`,
          )
          .join("");

  return `
    <section>
      <h2>Storico dei consensi privacy</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Versione informativa</th>
            <th scope="col">Accettato il</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>
  `;
}

function buildUserDataHtml(
  data: UserDataExport,
  subjectName: string,
): string {
  const title = `Dati personali — ${subjectName}`;

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 20px;
      background: #f4f4f5;
      color: #18181b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
    }
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 18px;
    }
    header { border-bottom: 3px solid #047857; padding-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
    .subtitle { margin: 8px 0 0; color: #52525b; font-size: 14px; }
    h2 {
      margin: 32px 0 10px;
      font-size: 18px;
      letter-spacing: -0.01em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 9px 12px;
      border: 1px solid #e4e4e7;
      text-align: left;
      vertical-align: top;
    }
    thead th { background: #f4f4f5; font-weight: 600; }
    tbody th { width: 34%; background: #fafafa; font-weight: 600; }
    .message { white-space: pre-wrap; }
    .empty { color: #71717a; font-style: italic; }
    footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e4e4e7;
      color: #71717a;
      font-size: 12px;
    }
    @media print {
      body { padding: 0; background: #ffffff; }
      main { max-width: none; border: 0; border-radius: 0; padding: 0; }
      section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">
        Esportazione generata il ${escapeHtml(formatDateTime(data.generated_at))}
        · Versione formato ${escapeHtml(data.export_version)}
      </p>
    </header>

    ${renderAccountSection(data)}
    ${renderProfileSection(data.profile)}
    ${renderEventResponses(data.event_responses)}
    ${renderGenericRequests(data.generic_requests)}
    ${renderConsents(data.privacy_consents)}

    <footer>
      Documento generato dal portale del Gruppo Alpini su richiesta
      dell’interessato o di un amministratore autorizzato. Contiene dati
      personali: conservalo in un luogo sicuro e non condividerlo con terzi non
      autorizzati.
    </footer>
  </main>
</body>
</html>`;
}

function buildUserDataText(
  data: UserDataExport,
  subjectName: string,
): string {
  const lines: string[] = [];
  const separator = "----------------------------------------";

  lines.push(`DATI PERSONALI — ${subjectName}`);
  lines.push(
    `Esportazione generata il ${formatDateTime(data.generated_at)} · Versione formato ${data.export_version}`,
  );
  lines.push("");

  lines.push("ACCOUNT E AUTENTICAZIONE");
  lines.push(separator);
  lines.push(`ID utente: ${displayText(data.user.id)}`);
  lines.push(`Email: ${displayText(data.user.email)}`);
  lines.push(`Account creato il: ${formatDateTime(data.user.created_at)}`);
  lines.push(
    `Email confermata il: ${formatDateTime(data.user.email_confirmed_at)}`,
  );
  lines.push(`Ultimo accesso: ${formatDateTime(data.user.last_sign_in_at)}`);
  lines.push("");

  lines.push("SCHEDA PERSONALE");
  lines.push(separator);
  if (!data.profile) {
    lines.push("Nessuna scheda personale associata all’account.");
  } else {
    lines.push(`Nome completo: ${displayText(data.profile.full_name)}`);
    lines.push(`Data di nascita: ${formatDate(data.profile.birth_date)}`);
    lines.push(
      `Anno di leva: ${
        data.profile.enlistment_year === null
          ? "Non indicato"
          : String(data.profile.enlistment_year)
      }`,
    );
    lines.push(`Luogo di servizio: ${displayText(data.profile.service_place)}`);
    lines.push(`Amministratore: ${data.profile.is_admin ? "Sì" : "No"}`);
    lines.push(
      `Ultimo aggiornamento: ${formatDateTime(data.profile.updated_at)}`,
    );
  }
  lines.push("");

  lines.push("RISPOSTE AGLI EVENTI");
  lines.push(separator);
  if (data.event_responses.length === 0) {
    lines.push("Nessuna risposta agli eventi.");
  } else {
    for (const row of data.event_responses) {
      const date = row.is_all_day
        ? formatDate(row.event_date)
        : formatDateTime(row.event_date);
      const status =
        row.status_label || EVENT_STATUS_LABELS[row.status] || row.status;
      lines.push(`- ${displayText(row.event_title)}`);
      lines.push(`  Data: ${date}`);
      lines.push(`  Luogo: ${displayText(row.location)}`);
      lines.push(`  Risposta: ${displayText(status)}`);
    }
  }
  lines.push("");

  lines.push("RICHIESTE ALLA SEGRETERIA");
  lines.push(separator);
  if (data.generic_requests.length === 0) {
    lines.push("Nessuna richiesta inviata.");
  } else {
    for (const row of data.generic_requests) {
      const status =
        row.status_label || REQUEST_STATUS_LABELS[row.status] || row.status;
      lines.push(`- ${formatDateTime(row.created_at)} · ${displayText(status)}`);
      lines.push(`  ${displayText(row.message)}`);
    }
  }
  lines.push("");

  lines.push("STORICO DEI CONSENSI PRIVACY");
  lines.push(separator);
  if (data.privacy_consents.length === 0) {
    lines.push("Nessun consenso registrato.");
  } else {
    for (const row of data.privacy_consents) {
      lines.push(
        `- Versione ${displayText(row.policy_version)} · accettato il ${formatDateTime(row.accepted_at)}`,
      );
    }
  }
  lines.push("");
  lines.push(separator);
  lines.push(
    "Documento generato dal portale del Gruppo Alpini su richiesta dell’interessato o di un amministratore autorizzato.",
  );
  lines.push(
    "Contiene dati personali: conservalo in un luogo sicuro e non condividerlo con terzi non autorizzati.",
  );

  return lines.join("\n");
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "socio";
}

export function buildExportFilename(
  displayName: string,
  format: ExportFormat,
  generatedAt: string,
): string {
  const date = /^\d{4}-\d{2}-\d{2}/.test(generatedAt)
    ? generatedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const extension =
    format === "json" ? "json" : format === "text" ? "txt" : "html";

  return `dati-personali-${slugify(displayName)}-${date}.${extension}`;
}

/**
 * Downloads the export as JSON (portability), plain text (email) or a
 * standalone, printable HTML document (offline delivery by an administrator).
 */
export function downloadUserDataExport(
  data: UserDataExport,
  format: ExportFormat,
  displayName: string,
): void {
  const subjectName =
    data.profile?.full_name?.trim() || data.user.email || displayName;
  const content =
    format === "json"
      ? JSON.stringify(data, null, 2)
      : format === "text"
        ? buildUserDataText(data, subjectName)
        : buildUserDataHtml(data, subjectName);
  const mimeType =
    format === "json"
      ? "application/json;charset=utf-8"
      : format === "text"
        ? "text/plain;charset=utf-8"
        : "text/html;charset=utf-8";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = buildExportFilename(
    subjectName,
    format,
    data.generated_at,
  );
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();

  // Safari/Firefox may still be reading the blob when click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
