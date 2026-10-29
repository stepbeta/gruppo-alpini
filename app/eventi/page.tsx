import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { EventsPage } from "./events-page";

export const metadata: Metadata = {
  title: "Eventi — Gruppo Alpini",
  description:
    "Calendario degli eventi del Gruppo Alpini e adesioni dei soci.",
};

export default function EventiPage() {
  return (
    <AuthGuard>
      <EventsPage />
    </AuthGuard>
  );
}
