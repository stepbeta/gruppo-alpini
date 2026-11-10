import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { OrganizationSettingsAdmin } from "./organization-settings-admin";

export const metadata: Metadata = {
  title: "Impostazioni privacy — Gruppo Alpini",
  description:
    "Gestione dei dati del titolare del trattamento pubblicati sulla pagina privacy del Gruppo Alpini.",
};

export default function OrganizationSettingsPage() {
  return (
    <AuthGuard>
      <OrganizationSettingsAdmin />
    </AuthGuard>
  );
}
