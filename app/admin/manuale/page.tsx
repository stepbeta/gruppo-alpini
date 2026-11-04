import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { AdminManual } from "./admin-manual";

export const metadata: Metadata = {
  title: "Manuale amministratore — Gruppo Alpini",
  description:
    "Guida all’uso delle funzioni amministrative del portale del Gruppo Alpini.",
};

export default function AdminManualPage() {
  return (
    <AuthGuard>
      <AdminManual />
    </AuthGuard>
  );
}
