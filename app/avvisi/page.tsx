import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { AnnouncementsAdmin } from "./announcements-admin";

export const metadata: Metadata = {
  title: "Avvisi del portale — Gruppo Alpini",
  description:
    "Gestione degli avvisi mostrati in cima alle pagine del portale del Gruppo Alpini.",
};

export default function AvvisiPage() {
  return (
    <AuthGuard>
      <AnnouncementsAdmin />
    </AuthGuard>
  );
}
