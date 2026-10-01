import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/vendas", label: "Histórico de vendas" },
  { href: "/produtos", label: "Produtos e preços" },
  { href: "/clientes", label: "Clientes" },
  { href: "/fiados", label: "Fiados" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/estoque/conferencia", label: "Conferência de estoque" },
];

export const metadata = { title: "Mais" };

export default async function MaisPage() {
  const session = await getSessionState();
  const profile = session.status === "ok" ? session.profile : null;

  return (
    <div>
      <h1 className="font-display text-3xl">Mais</h1>
      {profile ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.full_name} · {profile.role_name}
        </p>
      ) : null}
      <div className="mt-5 grid gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="flex h-14 items-center rounded-2xl border bg-card px-4 font-medium">
            {link.label}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
