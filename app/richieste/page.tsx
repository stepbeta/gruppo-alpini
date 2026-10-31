import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { RequestsPage } from "./requests-page";

export const metadata: Metadata = {
  title: "Richieste — Gruppo Alpini",
  description:
    "Invia richieste e comunicazioni alla segreteria del Gruppo Alpini.",
};

export default function RichiestePage() {
  return (
    <AuthGuard>
      <RequestsPage />
    </AuthGuard>
  );
}
