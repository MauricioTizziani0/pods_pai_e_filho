import { Filter } from "lucide-react";
import { loadCatalog } from "@/lib/data/catalog";
import { getSessionState } from "@/lib/auth";
import { loadConsultasFinancialSummary } from "@/lib/data/dashboard";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, resolvePeriod } from "@/lib/format";
import type { SalesReport } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { controlClass } from "@/components/ui/field";
import { IceFilterSelect } from "@/components/catalog/flavor-filters";
import { buttonVariants } from "@/components/ui/button";
import { iceFilterToBool, parseIceParam } from "@/lib/domain/flavors";
import { cn } from "@/lib/utils";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const period = resolvePeriod({
    periodo: params.periodo ?? (params.de || params.ate ? "personalizado" : undefined),
    de: params.de,
    ate: params.ate,
  });
  const [catalog, session] = await Promise.all([loadCatalog(), getSessionState()]);
  const consultas = session.status === "ok" && !session.profile.can_write;
  const credit = params.fiado === "sim" ? true : params.fiado === "nao" ? false : null;
  const ice = iceFilterToBool(parseIceParam(params.ice));
  let reportError: string | null = null;
  let consultasSummary: Awaited<ReturnType<typeof loadConsultasFinancialSummary>> | null = null;
  let report: SalesReport = {
    by_customer_type: [],
    by_status: [],
    by_product: [],
  };
  if (consultas) {
    consultasSummary = await loadConsultasFinancialSummary(period.from, period.to, {
      productId: params.produto,
      customerName: params.cliente,
      customerTypeId: params.tipo,
      paymentStatusId: params.status,
      credit,
      ice,
      flavor: params.sabor,
    });
    if (!consultasSummary.ok) reportError = consultasSummary.message;
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("sales_report", {
      p_from: period.from,
      p_to: period.to,
      p_product_id: params.produto || null,
      p_customer_id: null,
      p_customer_name: params.cliente || null,
      p_customer_type_id: params.tipo || null,
      p_payment_status_id: params.status || null,
      p_is_credit: credit,
      p_is_ice: ice,
      p_flavor: params.sabor || null,
    });
    if (error) reportError = error.message;
    report = (data ?? report) as SalesReport;
  }
  const field = cn(controlClass, "h-11");

  return (
    <div className="grid w-full min-w-0 gap-6">
      <PageHeading title="Relatórios" eyebrow="Análise" description={period.label} />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : null}
      {reportError ? <Notice>{reportError}</Notice> : null}

      <form className="tech-card grid gap-2 p-3 md:p-4" method="get">
        <p className="eyebrow flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> Filtros
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          <input type="hidden" name="periodo" value="personalizado" />
          <input className={field} type="date" name="de" defaultValue={params.de ?? ""} aria-label="De" />
          <input className={field} type="date" name="ate" defaultValue={params.ate ?? ""} aria-label="Até" />
          <input
            className={cn(field, "sm:col-span-2")}
            name="cliente"
            placeholder="Cliente"
            defaultValue={params.cliente ?? ""}
          />
          <select className={field} name="produto" defaultValue={params.produto ?? ""} aria-label="Produto">
            <option value="">Todos os produtos</option>
            {catalog.ok
              ? catalog.data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))
              : null}
          </select>
          <select className={field} name="tipo" defaultValue={params.tipo ?? ""} aria-label="Tipo de cliente">
            <option value="">Todos os tipos</option>
            {catalog.ok
              ? catalog.data.customerTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))
              : null}
          </select>
          <select className={field} name="status" defaultValue={params.status ?? ""} aria-label="Status">
            <option value="">Todos os status</option>
            {catalog.ok
              ? catalog.data.statuses
                  .filter((status) => status.active)
                  .map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))
              : null}
          </select>
          <select className={field} name="fiado" defaultValue={params.fiado ?? ""} aria-label="Fiado">
            <option value="">Fiado: todos</option>
            <option value="sim">Só fiado</option>
            <option value="nao">Sem fiado</option>
          </select>
          <IceFilterSelect defaultValue={params.ice} className={field} />
          <input
            className={field}
            name="sabor"
            placeholder="Sabor (ex.: Grape Ice)"
            defaultValue={params.sabor ?? ""}
            aria-label="Sabor"
          />
          <button className={cn(buttonVariants(), "h-11 w-full sm:col-span-2 md:col-span-4")} type="submit">
            Atualizar
          </button>
        </div>
      </form>

      {!reportError && consultas && consultasSummary?.ok ? (
        <ConsultasReport summary={consultasSummary.summary} />
      ) : null}

      {!reportError && !consultas ? (
        <div className="stagger grid gap-4">
          <ReportTable title="Por tipo de cliente" rows={report.by_customer_type} />
          <ReportTable title="Por status" rows={report.by_status} />
          <ReportTable title="Por produto" rows={report.by_product} showStock />
        </div>
      ) : null}
    </div>
  );
}

function ReportTable({
  title,
  rows,
  showStock = false,
}: {
  title: string;
  rows: SalesReport["by_product"];
  showStock?: boolean;
}) {
  const totals = rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + Number(row.quantity),
      revenue: acc.revenue + Number(row.revenue),
      transfer: acc.transfer + Number(row.transfer),
      profit: acc.profit + Number(row.profit),
      stock: acc.stock + Number(row.stock ?? 0),
    }),
    { quantity: 0, revenue: 0, transfer: 0, profit: 0, stock: 0 },
  );
  const maxRevenue = Math.max(1, ...rows.map((row) => Number(row.revenue)));

  return (
    <section className="tech-card tech-card-accent min-w-0 overflow-hidden">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5">
        <h2 className="min-w-0 break-words font-display text-base font-semibold md:text-lg">{title}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">{rows.length} linha(s)</span>
      </header>

      <ul className="grid divide-y divide-border/70 md:hidden">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sem dados para este recorte.</li>
        ) : null}
        {rows.map((row) => {
          const share = (Number(row.revenue) / maxRevenue) * 100;
          return (
            <li key={row.name} className="grid min-w-0 gap-2 px-4 py-3">
              <p className="min-w-0 break-words font-medium">{row.name}</p>
              <div className="bar-track h-1">
                <div className="bar-fill" style={{ width: `${Math.max(2, share)}%` }} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Qtd</dt>
                  <dd className="font-medium tabular-nums">{row.quantity}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Faturamento</dt>
                  <dd className="break-words font-medium tabular-nums">{formatBRL(row.revenue)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Repasse</dt>
                  <dd className="break-words tabular-nums text-muted-foreground">{formatBRL(row.transfer)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Lucro</dt>
                  <dd className="break-words font-medium tabular-nums text-success">{formatBRL(row.profit)}</dd>
                </div>
                {showStock ? (
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Estoque</dt>
                    <dd className="font-medium tabular-nums">{row.stock ?? 0}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
        {rows.length > 1 ? (
          <li className="grid grid-cols-2 gap-2 bg-surface/60 px-4 py-3 text-xs">
            <p className="col-span-2 eyebrow">Total</p>
            <span className="tabular-nums">{totals.quantity} un</span>
            <span className="break-words text-right font-medium tabular-nums">{formatBRL(totals.revenue)}</span>
            <span className="break-words tabular-nums text-muted-foreground">{formatBRL(totals.transfer)}</span>
            <span className="break-words text-right font-medium tabular-nums text-success">{formatBRL(totals.profit)}</span>
          </li>
        ) : null}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="table-tech min-w-[40rem]">
          <thead>
            <tr>
              <th>Nome</th>
              <th className="text-right">Qtd</th>
              <th className="text-right">Faturamento</th>
              <th className="text-right">Repasse</th>
              <th className="text-right">Lucro</th>
              {showStock ? <th className="text-right">Estoque</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showStock ? 6 : 5} className="py-6 text-center text-muted-foreground">
                  Sem dados para este recorte.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const share = (Number(row.revenue) / maxRevenue) * 100;
              return (
                <tr key={row.name}>
                  <td>
                    <p className="font-medium">{row.name}</p>
                    <div className="bar-track mt-1.5 h-1 max-w-[12rem]">
                      <div className="bar-fill" style={{ width: `${Math.max(2, share)}%` }} />
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{row.quantity}</td>
                  <td className="text-right font-medium tabular-nums">{formatBRL(row.revenue)}</td>
                  <td className="text-right tabular-nums text-muted-foreground">{formatBRL(row.transfer)}</td>
                  <td className="text-right font-medium tabular-nums text-success">{formatBRL(row.profit)}</td>
                  {showStock ? <td className="text-right tabular-nums">{row.stock ?? 0}</td> : null}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 1 ? (
            <tfoot>
              <tr className="border-t border-border bg-surface/60 font-semibold">
                <td className="eyebrow">Total</td>
                <td className="text-right tabular-nums">{totals.quantity}</td>
                <td className="text-right font-display tabular-nums">{formatBRL(totals.revenue)}</td>
                <td className="text-right tabular-nums text-muted-foreground">{formatBRL(totals.transfer)}</td>
                <td className="text-right font-display tabular-nums text-success">{formatBRL(totals.profit)}</td>
                {showStock ? <td className="text-right tabular-nums">{totals.stock}</td> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

function ConsultasReport({ summary }: { summary: NonNullable<Extract<Awaited<ReturnType<typeof loadConsultasFinancialSummary>>, { ok: true }>["summary"]> }) {
  const metrics: Array<{ label: string; value: string; hint?: string; incomplete?: boolean }> = [
    { label: "Quantidade vendida", value: `${summary.units_sold} un`, hint: `${summary.sales_count} venda(s)` },
    { label: "Faturamento", value: formatBRL(summary.revenue) },
    { label: "Custo dos produtos vendidos", value: summary.cost_missing_items ? "Dados incompletos" : formatBRL(summary.cost_sold), hint: summary.cost_missing_items ? `${formatBRL(summary.cost_sold)} em custos informados · ${summary.cost_missing_items} item(ns) sem custo histórico.` : "Todos os custos do período estão informados.", incomplete: summary.cost_missing_items > 0 },
    { label: "Repasse", value: formatBRL(summary.transfer_total) },
    { label: "Lucro do pai", value: summary.father_profit_missing_items ? "Dados incompletos" : formatBRL(summary.father_profit_total), hint: summary.father_profit_missing_items ? `${formatBRL(summary.father_profit_total)} apurados · ${summary.father_profit_missing_items} item(ns) sem custo histórico.` : "Lucro referente aos itens vendidos.", incomplete: summary.father_profit_missing_items > 0 },
    { label: "Repasse já recebido", value: formatBRL(summary.transfer_received) },
    { label: "Repasse pendente agora", value: formatBRL(summary.transfer_due_now) },
    { label: "Repasse futuro", value: formatBRL(summary.transfer_future) },
  ];
  return (
    <section className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Relatório financeiro do pai">
      {metrics.map((metric) => (
        <article key={metric.label} className="tech-card min-w-0 p-4">
          <p className="eyebrow break-words">{metric.label}</p>
          <p className={cn("mt-3 break-words font-display text-xl font-bold tabular-nums sm:text-2xl", metric.incomplete && "text-warning")}>{metric.value}</p>
          {metric.hint ? <p className="mt-2 break-words text-xs text-muted-foreground">{metric.hint}</p> : null}
        </article>
      ))}
    </section>
  );
}
