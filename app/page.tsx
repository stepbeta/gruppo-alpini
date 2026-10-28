"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { getFirstName, getInitials, getUserDisplayName } from "@/lib/display";
import { fetchProfile, type Profile } from "@/lib/profile";
import {
  ArrowRightIcon,
  CalendarIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@/components/icons";

export default function HomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const { user } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    fetchProfile(userId).then(({ profile: nextProfile }) => {
      if (isActive) setProfile(nextProfile);
    });

    return () => {
      isActive = false;
    };
  }, [userId]);

  if (!user) return null;

  const displayName = profile?.full_name?.trim() || getUserDisplayName(user);
  const firstName = getFirstName(displayName);
  const initials = getInitials(displayName);
  const isAdmin = profile?.is_admin === true;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 px-6 py-10 text-white shadow-xl shadow-emerald-950/15 sm:px-10 sm:py-12">
          <div className="relative z-10 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Portale dei soci
              </p>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Amministratore
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Bentornato, {firstName}.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50/90 sm:text-base">
              Questo è il tuo spazio nel Gruppo Alpini. Tieni aggiornata la tua
              scheda e preparati alle prossime attività del gruppo.
            </p>

            <Link
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              href="/profile"
            >
              Vai al tuo profilo
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-6 right-0 h-52 w-auto text-emerald-950/25 sm:h-64"
            fill="none"
            viewBox="0 0 360 180"
          >
            <path
              d="M0 180 86 62l40 55 42-64 58 85 32-45 102 87H0Z"
              fill="currentColor"
            />
            <path
              d="m86 62 17 23 23 32 31-47 37-17 58 85"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <Link
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
            href="/profile"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {initials}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {displayName}
                  </h2>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
              </div>
              <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700 dark:group-hover:text-emerald-400" />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Amministratore
                </span>
              ) : null}
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                La tua scheda personale
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Controlla e aggiorna nome, data di nascita, anno di leva e luogo di
              servizio.
            </p>
          </Link>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <CalendarIcon className="h-4.5 w-4.5" />
              </span>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Prossimamente
              </h2>
            </div>

            <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Il portale crescerà nelle prossime fasi con nuovi strumenti per la
              vita del gruppo.
            </p>

            <ul className="mt-5 space-y-3">
              {[
                {
                  icon: CalendarIcon,
                  title: "Eventi e adesioni",
                  description: "Calendario delle attività e conferme di presenza.",
                },
                {
                  icon: UsersIcon,
                  title: "Richieste e comunicazioni",
                  description: "Un canale diretto con gli amministratori.",
                },
                {
                  icon: MapPinIcon,
                  title: "Vita del gruppo",
                  description: "Luoghi, iniziative e momenti condivisi.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <li className="flex items-start gap-3" key={item.title}>
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {item.title}
                      </p>
                      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              In arrivo
            </p>
          </div>
        </section>

        <section className="mt-5">
          <Link
            className="group flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
            href="/iscritti"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <UsersIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Lista iscritti
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  Consulta i soci del gruppo e cerca per nome o luogo di
                  servizio.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Apri la lista
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
