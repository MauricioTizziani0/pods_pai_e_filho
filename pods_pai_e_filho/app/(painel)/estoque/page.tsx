import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { loadCatalog, loadLowStockThreshold } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { StockMovement } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { StockEntryForm } from "@/components/stock/stock-entry-form";

export const metadata = { title: "Estoque" };

export default async function EstoquePage() {
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

  const groups = new Map<string, typeof catalog.data.stock>();
  for (const item of catalog.data.stock) {
    const list = groups.get(item.product_name) ?? [];
    list.push(item);
    groups.set(item.product_name, list);
  }

  return (
    <div className="grid gap-6">
      <PageHeading
        title="Estoque"
        description="O saldo vem das movimentações. Venda, fiado ou a receber baixam na hora."
        action={{ href: "/estoque/conferencia", label: "Conferir" }}
      />
      <div className="grid gap-3">
        {[...groups.entries()].map(([product, items]) => {
          const total = items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <article key={product} className="rounded-2xl border bg-card p-4">
              <div className="flex items-end justify-between">
                <h2 className="font-display text-2xl">{product}</h2>
                <p className="text-lg font-semibold tabular-nums">{total} un</p>
              </div>
              <ul className="mt-3 grid gap-2">
                {items.map((item) => (
                  <li key={item.variant_id} className="flex items-center justify-between text-sm">
                    <span>
                      {item.variant_name}
                      {!item.variant_active ? " · inativo" : ""}
                    </span>
                    <span className={item.quantity <= threshold ? "font-semibold text-amber-800" : "tabular-nums"}>
                      {item.quantity}
                      {item.quantity <= threshold ? " · baixo" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {canWrite ? <StockEntryForm stock={catalog.data.stock} canWrite={canWrite} /> : null}
      <section>
        <h2 className="mb-3 font-display text-2xl">Movimentações recentes</h2>
        <div className="grid gap-2">
          {((movements ?? []) as StockMovement[]).map((movement) => (
            <article key={movement.id} className="rounded-xl border bg-card px-3 py-2 text-sm">
              <p className="font-medium">
                {movement.movement_name} · {movement.product_name} · {movement.variant_name}
              </p>
              <p className="text-muted-foreground">
                {movement.direction > 0 ? "+" : "−"}
                {movement.quantity} · {formatDate(movement.movement_date)}
                {movement.user_name ? ` · ${movement.user_name}` : ""}
                {movement.sale_id ? (
                  <>
                    {" · "}
                    <Link href={`/vendas/${movement.sale_id}`} className="underline">
                      ver venda
                    </Link>
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
