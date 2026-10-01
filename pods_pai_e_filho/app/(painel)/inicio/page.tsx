import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { loadDashboard } from "@/lib/data/dashboard";
import { formatBRL, formatDate, resolvePeriod } from "@/lib/format";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { PaymentBadge, CreditBadge } from "@/components/sales/badges";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const params = await searchParams;
  const period = resolvePeriod(params);
  const session = await getSessionState();
  const canWrite = session.status === "ok" && session.profile.can_write;
  const dashboard = await loadDashboard(period.from, period.to);

  if (!dashboard.ok) {
    return (
      <div className="grid gap-4">
        <PageHeading title="Dashboard" />
        <Notice>{dashboard.message}</Notice>
      </div>
    );
  }

  const stockTotal = dashboard.stock.reduce((total, item) => total + item.quantity, 0);
  const byProduct = new Map<string, number>();
  for (const item of dashboard.stock) {
    byProduct.set(item.product_name, (byProduct.get(item.product_name) ?? 0) + item.quantity);
  }
  const low = dashboard.stock.filter(
    (item) =>
      item.product_active &&
      item.variant_active &&
      item.quantity <= dashboard.lowStockThreshold,
  );

  const cards = [
    { label: "Dinheiro recebido", value: formatBRL(dashboard.metrics.money_received), tone: "default" },
    { label: "A receber", value: formatBRL(dashboard.metrics.receivable), tone: "default" },
    { label: "Lucro recebido", value: formatBRL(dashboard.metrics.profit_received), tone: "default" },
    { label: "Lucro total", value: formatBRL(dashboard.metrics.profit_total), tone: "default" },
    { label: "A enviar ao pai agora", value: formatBRL(dashboard.metrics.transfer_due_now), tone: "alert" },
    { label: "Repasse futuro", value: formatBRL(dashboard.metrics.transfer_future), tone: "default" },
    { label: "Repasse de vendas recebidas", value: formatBRL(dashboard.metrics.transfer_from_received), tone: "default" },
    { label: "Repasse total vendido", value: formatBRL(dashboard.metrics.transfer_total), tone: "default" },
  ];

  return (
    <div className="grid gap-6">
      <PageHeading
        title="Dashboard"
        description={period.label}
        action={canWrite ? { href: "/vendas/nova", label: "Nova venda" } : undefined}
      />

      <form className="flex flex-wrap gap-2" method="get">
        <PeriodLink current={params.periodo} value="" label="Tudo" />
        <PeriodLink current={params.periodo} value="mes" label="Este mês" />
        <input type="hidden" name="periodo" value="personalizado" />
        <input className="h-11 rounded-xl border bg-card px-3 text-sm" type="date" name="de" defaultValue={params.de ?? period.from ?? ""} />
        <input className="h-11 rounded-xl border bg-card px-3 text-sm" type="date" name="ate" defaultValue={params.ate ?? period.to ?? ""} />
        <button className="h-11 rounded-xl border bg-card px-4 text-sm font-medium" type="submit">
          Filtrar
        </button>
      </form>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className={cn(
              "rounded-2xl border bg-card p-4",
              card.tone === "alert" && "border-orange-200 bg-orange-50",
            )}
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums md:text-2xl">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border bg-card p-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl">Estoque</h2>
              <p className="text-3xl font-semibold tabular-nums">{stockTotal} un</p>
            </div>
            <Link href="/estoque" className="text-sm font-medium text-primary">
              Ver estoque
            </Link>
          </div>
          <ul className="mt-4 grid gap-2 text-sm">
            {[...byProduct.entries()].map(([name, quantity]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="tabular-nums font-medium">{quantity}</span>
              </li>
            ))}
          </ul>
          {low.length > 0 ? (
            <p className="mt-4 text-sm text-amber-900">
              Estoque baixo: {low.map((item) => `${item.product_name} ${item.variant_name} (${item.quantity})`).join(", ")}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum sabor abaixo do limite.</p>
          )}
          {dashboard.divergences.length > 0 ? (
            <p className="mt-2 text-sm text-amber-900">
              {dashboard.divergences.length} divergência(s) na última conferência.
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border bg-card p-4">
          <h2 className="font-display text-2xl">Vendas do período</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {dashboard.metrics.sales_count} vendas · {dashboard.metrics.units_sold} unidades
          </p>
          <div className="mt-4 grid gap-3">
            {dashboard.sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma venda neste recorte.</p>
            ) : (
              dashboard.sales.map((sale) => (
                <Link key={sale.id} href={`/vendas/${sale.id}`} className="block">
                  <p className="font-medium">{sale.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(sale.sale_date)} · {sale.items_label} · {formatBRL(sale.total_amount)}
                  </p>
                  <div className="mt-1 flex gap-1">
                    <PaymentBadge name={sale.payment_status_name} received={sale.counts_as_received} />
                    {sale.is_credit ? <CreditBadge /> : null}
                  </div>
                </Link>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function PeriodLink({
  current,
  value,
  label,
}: {
  current?: string;
  value: string;
  label: string;
}) {
  const active = (current ?? "") === value || (!current && value === "");
  const href = value ? `/inicio?periodo=${value}` : "/inicio";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium",
        active ? "bg-primary text-primary-foreground" : "border bg-card",
      )}
    >
      {label}
    </Link>
  );
}
