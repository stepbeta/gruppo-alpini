import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
  bootstrapServiceRole,
  cleanupE2EData,
  createServiceClient,
  E2E_AUTH_DIR,
  readLocalSupabaseStatus,
  signInLocal,
  writeStorageState,
} from "./support/local-supabase";
import {
  allDayIso,
  createEvent,
  createUser,
  futureIso,
  pastIso,
  seedPath,
  type E2ESeed,
} from "./support/seed";

/**
 * Seeds the local database and writes Playwright storage states.
 *
 * `npm run test:e2e` resets the database first, so this setup starts from an
 * empty public schema and only creates clearly-labelled E2E fixtures.
 */
export default async function globalSetup(): Promise<void> {
  const status = readLocalSupabaseStatus();
  console.log(`[e2e] Seeding local Supabase at ${status.apiUrl}`);

  await bootstrapServiceRole(status);
  const service = createServiceClient(status);
  await cleanupE2EData(service);

  // Storage states contain short-lived local JWTs and are always regenerated.
  rmSync(E2E_AUTH_DIR, { recursive: true, force: true });

  const admin = await createUser(service, {
    admin: true,
    email: "e2e-admin@e2e.gruppo-alpini.test",
    fullName: "Ada Amministratrice",
  });
  const admin2 = await createUser(service, {
    admin: true,
    email: "e2e-admin-2@e2e.gruppo-alpini.test",
    fullName: "Bruno Bergamo",
  });
  const admin3 = await createUser(service, {
    admin: true,
    email: "e2e-admin-3@e2e.gruppo-alpini.test",
    fullName: "Carla Cadore",
  });
  const member = await createUser(service, {
    email: "e2e-member@e2e.gruppo-alpini.test",
    fullName: "Mario Socio",
  });
  const pending = await createUser(service, {
    approval: "pending",
    email: "e2e-pending@e2e.gruppo-alpini.test",
    fullName: "Pina In Attesa",
  });

  const createdBy = admin.id;

  const nextTimed = await createEvent(service, {
    title: "E2E · Cena sociale",
    eventDate: futureIso(2, 20, 0),
    location: "Sede E2E",
    description: "Cena di gruppo con le famiglie dei soci.",
    createdBy,
  });
  const nextAllDay = await createEvent(service, {
    title: "E2E · Raduno sezionale",
    eventDate: allDayIso(4),
    isAllDay: true,
    location: "Malga E2E",
    description: "Raduno alpino di tutta la giornata.",
    createdBy,
  });
  const thirdUpcoming = await createEvent(service, {
    title: "E2E · Assemblea ordinaria",
    eventDate: futureIso(6, 18, 30),
    location: "Sala E2E",
    description: "Assemblea dei soci con ordine del giorno.",
    createdBy,
  });
  const fourthUpcoming = await createEvent(service, {
    title: "E2E · Pellegrinaggio",
    eventDate: allDayIso(8),
    isAllDay: true,
    location: "Santuario E2E",
    createdBy,
  });
  const fifthUpcoming = await createEvent(service, {
    title: "E2E · Concerto alpino",
    eventDate: futureIso(10, 21, 0),
    location: "Piazza E2E",
    createdBy,
  });
  const shared = await createEvent(service, {
    title: "E2E · Evento condiviso lontano",
    eventDate: futureIso(13, 19, 0),
    location: "Rifugio E2E",
    description: "Evento usato per verificare i link condivisi fuori pagina.",
    createdBy,
  });
  const past = await createEvent(service, {
    title: "E2E · Escursione passata",
    eventDate: pastIso(5, 18),
    location: "Sentiero E2E",
    description: "Escursione già conclusa.",
    createdBy,
  });

  // Una richiesta già risolta resta nella bacheca senza alterare i contatori
  // delle richieste aperte usati dai test.
  const { error: requestError } = await service
    .from("generic_requests")
    .insert({
      user_id: member.id,
      message: "E2E · Richiesta storica già risolta",
      status: "resolved",
    });

  if (requestError) {
    throw new Error(
      `request fixture insert failed: ${requestError.code ?? "unknown"} ${requestError.message}`,
    );
  }

  mkdirSync(E2E_AUTH_DIR, { recursive: true });

  const seedUsers: E2ESeed["users"] = {
    admin,
    admin2,
    admin3,
    member,
    pending,
  };
  const seedEvents: E2ESeed["events"] = {
    nextTimed,
    nextAllDay,
    thirdUpcoming,
    fourthUpcoming,
    fifthUpcoming,
    shared,
    past,
  };

  for (const [role, user] of Object.entries(seedUsers)) {
    const session = await signInLocal(status, user.email, user.password);
    writeStorageState(status, session, `${role}.json`);
  }

  const seed: E2ESeed = { users: seedUsers, events: seedEvents };
  writeFileSync(seedPath(), JSON.stringify(seed, null, 2));
  console.log(
    `[e2e] Created ${Object.keys(seedUsers).length} users and ${Object.keys(seedEvents).length} events.`,
  );
}
