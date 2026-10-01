"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
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
  Bookmark,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const sideNav = [
  { href: "/inicio", label: "Dashboard", icon: LayoutDashboard },
  { href: "/produtos", label: "Produtos", icon: Boxes },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/vendas", label: "Vendas", icon: Receipt },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/fiados", label: "Fiados", icon: Bookmark },
  { href: "/repasses", label: "Repasses", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/vendas") {
    return pathname === "/vendas" || /^\/vendas\/(?!nova$)[^/]+$/.test(pathname);
  }
  if (href === "/inicio") return pathname === "/inicio";
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const saleHref = profile.can_write ? "/vendas/nova" : "/vendas";

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const mobile = [
    { href: "/inicio", label: "Início", icon: LayoutDashboard },
    { href: "/estoque", label: "Estoque", icon: Package },
    { href: saleHref, label: "Venda", icon: Plus, emphasis: true },
    { href: "/repasses", label: "Repasses", icon: Wallet },
    { href: "/mais", label: "Mais", icon: Menu },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="px-5 py-6">
          <p className="font-display text-2xl leading-none text-primary">Pods</p>
          <p className="mt-1 text-sm text-muted-foreground">Pai e Filho</p>
        </div>
        {profile.can_write ? (
          <div className="px-4">
            <Link
              href="/vendas/nova"
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Nova venda
            </Link>
          </div>
        ) : null}
        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
          {sideNav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">{profile.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.role_name}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex h-10 items-center gap-2 text-sm text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <div>
            <p className="font-display text-xl leading-none text-primary">Pods</p>
            <p className="text-xs text-muted-foreground">Pai e Filho</p>
          </div>
          <p className="max-w-[45%] truncate text-right text-sm">{profile.full_name}</p>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {mobile.map((item) => {
            const active = item.emphasis
              ? pathname.startsWith("/vendas/nova")
              : isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  item.emphasis && "-mt-4",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center",
                    item.emphasis
                      ? "h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-md"
                      : "h-6 w-6",
                  )}
                >
                  <Icon className={item.emphasis ? "h-5 w-5" : "h-5 w-5"} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
