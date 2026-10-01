import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { SchemaMissing } from "@/components/setup/schema-missing";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionState();
  if (session.status === "unauthenticated") redirect("/auth/login");
  if (session.status === "missing-schema") return <SchemaMissing message={session.message} />;
  if (session.status === "missing-profile") {
    return (
      <SchemaMissing message="Seu usuário ainda não tem perfil. Execute a migration e entre de novo para o gatilho criar o acesso." />
    );
  }

  return <AppShell profile={session.profile}>{children}</AppShell>;
}
