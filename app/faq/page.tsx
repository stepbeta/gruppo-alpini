import type { Metadata } from "next";
import { SessionGuard } from "@/components/session-guard";
import { FaqScreen } from "./faq-screen";

export const metadata: Metadata = {
  title: "Guida rapida e FAQ — Gruppo Alpini",
  description:
    "Risposte rapide per usare il portale del Gruppo Alpini: eventi e RSVP, richieste alla segreteria, lista iscritti, profilo e privacy.",
};

export default function FaqPage() {
  return (
    <SessionGuard>
      <FaqScreen />
    </SessionGuard>
  );
}
