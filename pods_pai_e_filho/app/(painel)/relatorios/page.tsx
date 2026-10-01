import { Filter } from "lucide-react";
import { loadCatalog } from "@/lib/data/catalog";
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
  const catalog = await loadCatalog();
  const supabase = await createClient();
  const credit = params.fiado === "sim" ? true : params.fiado === "nao" ? false : null;
  const ice = iceFilterToBool(parseIceParam(params.ice));
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

  const report = (data ?? {
    by_customer_type: [],
    by_status: [],
    by_product: [],
  }) as SalesReport;
  const field = cn(controlClass, "h-11");

  return (
    <div className="grid gap-6">
      <PageHeading title="Relatórios" eyebrow="Análise" description={period.label} />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : null}
      {error ? <Notice>{error.message}</Notice> : null}

      <form className="tech-card grid gap-2 p-3 md:p-4" method="get">
        <p className="eyebrow flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> Filtros
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input type="hidden" name="periodo" value="personalizado" />
          <input className={field} type="date" name="de" defaultValue={params.de ?? ""} aria-label="De" />
          <input className={field} type="date" name="ate" defaultValue={params.ate ?? ""} aria-label="Até" />
          <input
            className={cn(field, "col-span-2")}
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
          <button className={cn(buttonVariants(), "col-span-2 h-11 md:col-span-4")} type="submit">
            Atualizar
          </button>
        </div>
      </form>

      {!error ? (
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
    <section className="tech-card tech-card-accent overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5">
        <h2 className="font-display text-base font-semibold md:text-lg">{title}</h2>
        <span className="text-xs text-muted-foreground">{rows.length} linha(s)</span>
      </header>
      <div className="overflow-x-auto">
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
