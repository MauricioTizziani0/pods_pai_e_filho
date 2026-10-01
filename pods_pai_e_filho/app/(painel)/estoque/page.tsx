import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ClipboardCheck, Filter, History, Package } from "lucide-react";
import { getSessionState } from "@/lib/auth";
import { loadCatalog, loadLowStockThreshold } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { matchesFlavorSearch, matchesIceFilter, parseIceParam } from "@/lib/domain/flavors";
import type { StockMovement } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { StockEntryForm } from "@/components/stock/stock-entry-form";
import { IceBadge, StockBadge } from "@/components/sales/badges";
import { IceFilterSelect } from "@/components/catalog/flavor-filters";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { controlClass } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Estoque" };

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [catalog, session, threshold] = await Promise.all([
    loadCatalog(),
    getSessionState(),
    loadLowStockThreshold(),
  ]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  if (!catalog.ok) {
    return (
      <div>
        <PageHeading title="Estoque" />
        <Notice>{catalog.message}</Notice>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: movements } = await supabase
    .from("stock_movement_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);

  const iceFilter = parseIceParam(params.ice);
  const flavorQuery = params.sabor ?? "";
  const visibleStock = catalog.data.stock.filter(
    (item) =>
      matchesIceFilter(item.variant_is_ice, iceFilter) &&
      matchesFlavorSearch({ name: item.variant_name, is_ice: item.variant_is_ice }, flavorQuery),
  );

  const groups = new Map<string, typeof visibleStock>();
  for (const item of visibleStock) {
    const list = groups.get(item.product_name) ?? [];
    list.push(item);
    groups.set(item.product_name, list);
  }
  const total = visibleStock.reduce((sum, item) => sum + item.quantity, 0);
  const field = cn(controlClass, "h-11");

  return (
    <div className="grid gap-6">
      <PageHeading
        title="Estoque"
        eyebrow={`${total} unidades`}
        description="O saldo vem das movimentações. Venda, fiado ou a receber baixam na hora."
        action={{ href: "/estoque/conferencia", label: "Conferir" }}
      />

      <form className="tech-card grid gap-2 p-3 md:p-4" method="get">
        <p className="eyebrow flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> Filtros
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input
            className={cn(field, "col-span-2")}
            name="sabor"
            placeholder="Pesquisar sabor (ex.: Grape Ice)"
            defaultValue={params.sabor ?? ""}
            aria-label="Pesquisar sabor"
          />
          <IceFilterSelect defaultValue={params.ice} />
          <button className={cn(buttonVariants(), "h-11")} type="submit">
            Filtrar
          </button>
        </div>
      </form>

      <div className="stagger grid gap-3 md:grid-cols-2">
        {[...groups.entries()].map(([product, items]) => {
          const productTotal = items.reduce((sum, item) => sum + item.quantity, 0);
          const max = Math.max(1, ...items.map((item) => item.quantity));
          return (
            <Panel
              key={product}
              title={product}
              icon={Package}
              accent
              action={
                <p className="text-right">
                  <span className="block font-display text-2xl font-bold leading-none tabular-nums">{productTotal}</span>
                  <span className="eyebrow text-[10px]">unidades</span>
                </p>
              }
            >
              <ul className="grid gap-3">
                {items.map((item) => {
                  const lowStock = item.quantity <= threshold;
                  return (
                    <li key={item.variant_id} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{item.variant_name}</span>
                          {item.variant_is_ice ? <IceBadge /> : <span className="text-xs text-muted-foreground">Normal</span>}
                          {!item.variant_active ? <Badge variant="neutral">inativo</Badge> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StockBadge quantity={item.quantity} threshold={threshold} />
                          <span
                            className={cn(
                              "w-8 text-right font-display font-semibold tabular-nums",
                              lowStock && "text-warning",
                            )}
                          >
                            {item.quantity}
                          </span>
                        </span>
                      </div>
                      <div className="bar-track h-1.5">
                        <div
                          className={cn("bar-fill", lowStock && "bar-fill-muted")}
                          style={{ width: `${Math.max(3, (item.quantity / max) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })}
      </div>

      {canWrite ? <StockEntryForm stock={catalog.data.stock} canWrite={canWrite} /> : null}

      <Panel
        title="Movimentações recentes"
        description="Últimas 12 entradas, saídas e ajustes"
        icon={History}
        bodyClassName="p-0"
        action={
          <Link
            href="/estoque/conferencia"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Conferência
          </Link>
        }
      >
        {(movements ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {((movements ?? []) as StockMovement[]).map((movement) => {
              const positive = movement.direction > 0;
              return (
                <li key={movement.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                      positive
                        ? "border-success/35 bg-success/10 text-success"
                        : "border-primary/40 bg-primary/10 text-primary",
                    )}
                  >
                    {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {movement.product_name} · {movement.variant_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {movement.movement_name} · {formatDate(movement.movement_date)}
                      {movement.user_name ? ` · ${movement.user_name}` : ""}
                      {movement.sale_id ? (
                        <>
                          {" · "}
                          <Link href={`/vendas/${movement.sale_id}`} className="text-primary underline-offset-4 hover:underline">
                            ver venda
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-display text-base font-semibold tabular-nums",
                      positive ? "text-success" : "text-primary",
                    )}
                  >
                    {positive ? "+" : "−"}
                    {movement.quantity}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
