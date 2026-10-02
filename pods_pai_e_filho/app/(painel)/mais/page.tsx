import Link from "next/link";
import {
  BarChart3,
  Bookmark,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getSessionState } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { BrandPlate } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";

const groups: Array<{ label: string; links: Array<{ href: string; label: string; hint: string; icon: LucideIcon }> }> = [
  {
    label: "Operação",
    links: [
      { href: "/vendas", label: "Histórico de vendas", hint: "Filtros, situação e repasses", icon: Receipt },
      { href: "/produtos", label: "Produtos e preços", hint: "Sabores e tabela por tipo", icon: Boxes },
      { href: "/clientes", label: "Clientes", hint: "Cadastro opcional", icon: Users },
      { href: "/estoque/conferencia", label: "Conferência de estoque", hint: "Contagem física", icon: ClipboardCheck },
    ],
  },
  {
    label: "Financeiro",
    links: [{ href: "/fiados", label: "Fiados", hint: "A receber com repasse já contado", icon: Bookmark }],
  },
  {
    label: "Sistema",
    links: [
      { href: "/relatorios", label: "Relatórios", hint: "Por tipo, status e produto", icon: BarChart3 },
      { href: "/configuracoes", label: "Configurações", hint: "Pessoas, limites e cadastros", icon: Settings },
    ],
  },
];

export const metadata = { title: "Mais" };

export default async function MaisPage() {
  const session = await getSessionState();
  const profile = session.status === "ok" ? session.profile : null;
  const visibleGroups = profile?.can_write ? groups : [
    {
      label: "Consulta",
      links: [
        { href: "/produtos", label: "Produtos", hint: "Catálogo, sabores e estoque", icon: Boxes },
        { href: "/relatorios", label: "Relatórios", hint: "Vendas, custos e meu lucro", icon: BarChart3 },
      ],
    },
  ];

  return (
    <div className="grid w-full min-w-0 gap-5">
      <section className="tech-card tech-card-accent flex min-w-0 items-center gap-4 p-4">
        <BrandPlate size={64} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-none">PODS</p>
          <p className="brand-rules mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            Pai e Filho
          </p>
          {profile ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate text-foreground">{profile.full_name}</span>
              <Badge variant={profile.can_write ? "default" : "neutral"}>{profile.role_name}</Badge>
            </p>
          ) : null}
        </div>
      </section>

      {visibleGroups.map((group) => (
        <section key={group.label} className="grid gap-2">
          <p className="eyebrow px-1">{group.label}</p>
          <div className="stagger grid gap-2">
            {group.links.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="tech-card press flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:border-primary/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{link.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{link.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <div className="pt-2">
        <LogoutButton />
      </div>
    </div>
  );
}
