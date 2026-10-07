import { Filter } from "lucide-react";
import { redirect } from "next/navigation";
import { loadCatalog } from "@/lib/data/catalog";
import { listBatches } from "@/lib/data/batches";
import { loadFinancialSales } from "@/lib/data/financial-sales";
import { getSessionState } from "@/lib/auth";
import { loadConsultasFinancialSummary } from "@/lib/data/dashboard";
import { formatBRL, resolvePeriod } from "@/lib/format";
import type { SalesReport } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { controlClass } from "@/components/ui/field";
import { IceFilterSelect } from "@/components/catalog/flavor-filters";
import { buttonVariants } from "@/components/ui/button";
import { iceFilterToBool, parseIceParam } from "@/lib/domain/flavors";
import { cn } from "@/lib/utils";
import { isConsultasRole } from "@/lib/domain/roles";
import { buildFilterUrl, formatBatchLabel, resolveBatchFilter } from "@/lib/domain/batch-filters";
import { reportForBatchSales } from "@/lib/domain/batch-sales";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const params: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(rawParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const period = resolvePeriod({
    periodo: params.periodo ?? (params.de || params.ate ? "personalizado" : undefined),
    de: params.de,
    ate: params.ate,
  });
  const [catalog, session, batches] = await Promise.all([loadCatalog(), getSessionState(), listBatches()]);
  if (!batches.ok && params.lote && params.lote !== "todos") {
    return (
      <div className="grid w-full min-w-0 gap-6">
        <PageHeading title="Relatórios" eyebrow="Análise" description={`Lote selecionado · ${period.label}`} />
        <Notice>{batches.message}</Notice>
      </div>
    );
  }
  const selected = resolveBatchFilter(batches.batches, params.lote);
  if (batches.ok && selected.shouldCanonicalize) {
    redirect(buildFilterUrl("/relatorios", params, { lote: selected.value }));
  }
  const consultas = session.status === "ok" && isConsultasRole(session.profile.role_code);
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
      ice,
      flavor: params.sabor,
      batchId: selected.batchId,
    });
    if (!consultasSummary.ok) reportError = consultasSummary.message;
  } else {
    const result = await loadFinancialSales({
      from: period.from ?? undefined,
      to: period.to ?? undefined,
      productId: params.produto,
      customer: params.cliente,
      customerTypeId: params.tipo,
      paymentStatusId: params.status,
      credit: params.fiado,
      ice: params.ice,
      flavor: params.sabor,
      batchId: selected.batchId ?? undefined,
    });
    if (!result.ok) {
      reportError = result.message;
    } else {
      const stockByProduct = new Map<string, number>();
      if (catalog.ok) {
        for (const balance of catalog.data.stock) {
          if (ice !== null && balance.variant_is_ice !== ice) continue;
          stockByProduct.set(balance.product_id, (stockByProduct.get(balance.product_id) ?? 0) + Number(balance.quantity));
        }
      }
      const products = new Map(catalog.ok ? catalog.data.products.map((product) => [product.id, product]) : []);
      const customerTypes = new Map(catalog.ok ? catalog.data.customerTypes.map((type) => [type.id, type]) : []);
      const statuses = new Map(catalog.ok ? catalog.data.statuses.map((status) => [status.id, status]) : []);
      const lines = result.lines.map((line) => ({
        ...line,
        product_name: products.get(line.product_id)?.name ?? line.product_name,
        sale: {
          ...line.sale,
          customer_type_name: customerTypes.get(line.sale.customer_type_id)?.name ?? line.sale.customer_type_name,
          payment_status_name: statuses.get(line.sale.payment_status_id)?.name ?? line.sale.payment_status_name,
        },
      }));
      report = reportForBatchSales(lines, stockByProduct);

      // Keep active catalog rows with zero sales, and historical sold rows.
      if (catalog.ok) {
        const valid = lines.filter((line) => line.sale.is_valid);
        const soldProducts = new Set(valid.map((line) => line.product_id));
        const soldCustomerTypes = new Set(valid.map((line) => line.sale.customer_type_id));
        const soldStatuses = new Set(valid.map((line) => line.sale.payment_status_id));
        const emptyRow = (name: string) => ({ name, quantity: 0, revenue: "0.00", transfer: "0.00", profit: "0.00" });
        for (const type of catalog.data.customerTypes) {
          if (type.active && !soldCustomerTypes.has(type.id)) report.by_customer_type.push(emptyRow(type.name));
        }
        for (const status of catalog.data.statuses) {
          if (status.active && !status.is_terminal && !soldStatuses.has(status.id)) report.by_status.push(emptyRow(status.name));
        }
        for (const product of catalog.data.products) {
          if (product.active && !soldProducts.has(product.id) && (!params.produto || params.produto === product.id)) {
            report.by_product.push({ ...emptyRow(product.name), stock: stockByProduct.get(product.id) ?? 0 });
          }
        }
        report.by_product.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        const customerOrder = new Map(catalog.data.customerTypes.map((type) => [type.name, type.sort_order]));
        const statusOrder = new Map(catalog.data.statuses.map((status) => [status.name, status.sort_order]));
        report.by_customer_type.sort((a, b) => (customerOrder.get(a.name) ?? Infinity) - (customerOrder.get(b.name) ?? Infinity));
        report.by_status.sort((a, b) => (statusOrder.get(a.name) ?? Infinity) - (statusOrder.get(b.name) ?? Infinity));
      }
    }
  }
  const field = cn(controlClass, "h-11");

  return (
    <div className="grid w-full min-w-0 gap-6">
      <PageHeading title="Relatórios" eyebrow="Análise" description={`${selected.label} · ${period.label}`} />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : null}
      {!batches.ok ? <Notice>{batches.message}</Notice> : null}
      {reportError ? <Notice>{reportError}</Notice> : null}

      <form className="tech-card grid gap-2 p-3 md:p-4" method="get">
        <p className="eyebrow flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> Filtros
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          <input type="hidden" name="periodo" value="personalizado" />
          <select className={field} name="lote" defaultValue={selected.value} aria-label="Lote">
            <option value="todos">Todos os lotes</option>
            {batches.batches.map((batch) => (
              <option key={batch.batch_id} value={batch.batch_id}>{formatBatchLabel(batch)}</option>
            ))}
          </select>
          <input className={field} type="date" name="de" defaultValue={period.from ?? params.de ?? ""} aria-label="De" />
          <input className={field} type="date" name="ate" defaultValue={period.to ?? params.ate ?? ""} aria-label="Até" />
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
          {!consultas ? (
            <select className={field} name="fiado" defaultValue={params.fiado ?? ""} aria-label="Fiado">
              <option value="">Fiado: todos</option>
              <option value="sim">Só fiado</option>
              <option value="nao">Sem fiado</option>
            </select>
          ) : null}
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
        {rows.map((row, index) => {
          const share = (Number(row.revenue) / maxRevenue) * 100;
          return (
            <li key={`${row.name}-${index}`} className="grid min-w-0 gap-2 px-4 py-3">
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
                    <dt className="text-muted-foreground">Estoque geral</dt>
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
              {showStock ? <th className="text-right">Estoque geral</th> : null}
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
            {rows.map((row, index) => {
              const share = (Number(row.revenue) / maxRevenue) * 100;
              return (
                <tr key={`${row.name}-${index}`}>
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
