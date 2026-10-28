import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { MembersDirectory } from "./members-directory";

export const metadata: Metadata = {
  title: "Lista iscritti — Gruppo Alpini",
  description:
    "Elenco dei soci del Gruppo Alpini, consultabile dai membri autenticati.",
};

export default function IscrittiPage() {
  return (
    <AuthGuard>
      <MembersDirectory />
    </AuthGuard>
  );
}
