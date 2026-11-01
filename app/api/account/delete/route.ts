import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeleteAccountBody = {
  userId?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Deletes an auth user (and, by cascade, the linked profile).
 *
 * Self-service deletion only needs a valid session. Deleting another member
 * requires an administrator profile, which is checked server-side with the
 * service role. The service role key never reaches the browser.
 */
export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return jsonError(
      "Configurazione server incompleta: manca la chiave di servizio Supabase. Contatta un amministratore.",
      500,
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) {
    return jsonError("Sessione mancante. Accedi di nuovo e riprova.", 401);
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return jsonError("Sessione non valida o scaduta. Accedi di nuovo.", 401);
  }

  let body: DeleteAccountBody;

  try {
    body = (await request.json()) as DeleteAccountBody;
  } catch {
    return jsonError("Richiesta non valida.", 400);
  }

  const targetUserId =
    typeof body?.userId === "string" ? body.userId.trim() : "";

  if (!UUID_PATTERN.test(targetUserId)) {
    return jsonError("Identificativo utente non valido.", 400);
  }

  if (targetUserId !== user.id) {
    const { data: actorProfile, error: profileError } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to verify administrator profile", profileError);
      return jsonError(
        "Impossibile verificare i permessi. Riprova più tardi.",
        500,
      );
    }

    if (actorProfile?.is_admin !== true) {
      return jsonError(
        "Solo gli amministratori possono eliminare altri profili.",
        403,
      );
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    if (deleteError.status === 404) {
      return jsonError("Utente non trovato.", 404);
    }

    console.error("Unable to delete auth user", deleteError);
    return jsonError(
      "Impossibile eliminare l’account. Riprova o contatta un amministratore.",
      500,
    );
  }

  return NextResponse.json({ ok: true });
}
