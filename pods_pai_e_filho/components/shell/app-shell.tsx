"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bookmark,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BrandLockup, BrandMark } from "@/components/brand/logo";

const adminSideNav = [
  {
    label: "Operação",
    items: [
      { href: "/inicio", label: "Dashboard", icon: LayoutDashboard },
      { href: "/estoque", label: "Estoque", icon: Package },
      { href: "/produtos", label: "Produtos", icon: Boxes },
      { href: "/vendas", label: "Vendas", icon: Receipt },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/repasses", label: "Repasses", icon: Wallet },
      { href: "/fiados", label: "Fiados", icon: Bookmark },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/vendas") {
    return pathname === "/vendas" || /^\/vendas\/(?!nova$)[^/]+$/.test(pathname);
  }
  if (href === "/inicio") return pathname === "/inicio";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const sideNav = profile.can_write ? adminSideNav : [
    {
      label: "CONSULTAS",
      items: [
        { href: "/inicio", label: "Início", icon: LayoutDashboard },
        { href: "/estoque", label: "Estoque", icon: Package },
        { href: "/vendas", label: "Vendas", icon: Receipt },
        { href: "/repasses", label: "Financeiro", icon: Wallet },
      ],
    },
  ];

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const mobile = profile.can_write
    ? [
        { href: "/inicio", label: "Início", icon: LayoutDashboard },
        { href: "/estoque", label: "Estoque", icon: Package },
        { href: "/vendas/nova", label: "Vender", icon: Plus, emphasis: true },
        { href: "/repasses", label: "Financeiro", icon: Wallet },
        { href: "/mais", label: "Mais", icon: Menu },
      ]
    : [
        { href: "/inicio", label: "Início", icon: LayoutDashboard },
        { href: "/estoque", label: "Estoque", icon: Package },
        { href: "/vendas", label: "Vendas", icon: Receipt },
        { href: "/repasses", label: "Financeiro", icon: Wallet },
      ];

  return (
    <div className="min-h-dvh w-full min-w-0 max-w-full">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-[#0A0A0A]/95 backdrop-blur md:flex">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary via-primary/40 to-transparent" />

        <div className="px-5 pb-4 pt-5">
          <Link href="/inicio" className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
            <BrandLockup />
          </Link>
          <p className="brand-rules mt-3 w-full justify-center text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Sistema
          </p>
        </div>

        {profile.can_write ? (
          <div className="px-4">
            <Link
              href="/vendas/nova"
              className="press flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-glow-sm transition-[box-shadow,background-color] hover:bg-primary-glow hover:shadow-glow"
            >
              <Plus className="h-4 w-4" />
              Nova venda
            </Link>
          </div>
        ) : null}

        <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sideNav.map((group) => (
            <div key={group.label}>
              <p className="eyebrow px-3 pb-2 text-[10px]">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color] duration-150",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-glow-sm transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-colors",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 font-display text-xs font-bold text-primary">
              {initials(profile.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.role_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* ---------------- Conteúdo ---------------- */}
      <div className="w-full min-w-0 max-w-full md:pl-64">
        <header className="sticky top-0 z-30 w-full min-w-0 border-b border-border bg-background/85 backdrop-blur md:hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary via-primary/40 to-transparent" />
          <div className="flex min-w-0 items-center justify-between gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <Link href="/inicio" className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <BrandMark size={38} />
            </Link>
            <Link
              href="/mais"
              className="flex min-w-0 max-w-[70%] items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs"
              aria-label="Perfil e mais opções"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/40 bg-primary/10 font-display text-[10px] font-bold text-primary">
                {initials(profile.full_name)}
              </span>
              <span className="min-w-0 truncate">{profile.full_name}</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:py-8 md:pb-12">
          <div key={pathname} className="animate-enter w-full min-w-0 max-w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ---------------- Bottom nav (mobile) ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 w-full max-w-full border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className={cn("mx-auto grid w-full max-w-lg px-1 pb-[env(safe-area-inset-bottom)]", profile.can_write ? "grid-cols-5" : "grid-cols-4")}>
          {mobile.map((item) => {
            const active = item.emphasis
              ? pathname.startsWith("/vendas/nova")
              : isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  item.emphasis && "-mt-4",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {!item.emphasis && active ? (
                  <span aria-hidden className="absolute top-0 h-[2px] w-8 bg-primary shadow-glow-sm" />
                ) : null}
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center transition-[box-shadow,background-color]",
                    item.emphasis
                      ? "h-14 w-14 rounded-md border-2 border-background bg-primary text-primary-foreground shadow-glow"
                      : "h-6 w-6",
                  )}
                >
                  <Icon className={item.emphasis ? "h-6 w-6" : "h-5 w-5"} strokeWidth={item.emphasis ? 2.5 : 2} />
                </span>
                <span className={cn("w-full min-w-0 truncate px-0.5 text-center", item.emphasis && "font-semibold text-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
