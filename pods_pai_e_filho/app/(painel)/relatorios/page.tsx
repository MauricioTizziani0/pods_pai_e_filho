import { loadCatalog } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, resolvePeriod } from "@/lib/format";
import type { SalesReport } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";

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
  const { data, error } = await supabase.rpc("sales_report", {
    p_from: period.from,
    p_to: period.to,
    p_product_id: params.produto || null,
    p_customer_id: null,
    p_customer_name: params.cliente || null,
    p_customer_type_id: params.tipo || null,
    p_payment_status_id: params.status || null,
    p_is_credit: credit,
  });

  const report = (data ?? {
    by_customer_type: [],
    by_status: [],
    by_product: [],
  }) as SalesReport;

  return (
    <div className="grid gap-6">
      <PageHeading title="Relatórios" description={period.label} />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : null}
      {error ? <Notice>{error.message}</Notice> : null}
      <form className="grid gap-2 md:grid-cols-4" method="get">
        <input type="hidden" name="periodo" value="personalizado" />
        <input className="h-12 rounded-xl border bg-card px-3" type="date" name="de" defaultValue={params.de ?? ""} aria-label="De" />
        <input className="h-12 rounded-xl border bg-card px-3" type="date" name="ate" defaultValue={params.ate ?? ""} aria-label="Até" />
        <input className="h-12 rounded-xl border bg-card px-3" name="cliente" placeholder="Cliente" defaultValue={params.cliente ?? ""} />
        <select className="h-12 rounded-xl border bg-card px-3" name="produto" defaultValue={params.produto ?? ""}>
          <option value="">Todos os produtos</option>
          {catalog.ok
            ? catalog.data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))
            : null}
        </select>
        <select className="h-12 rounded-xl border bg-card px-3" name="tipo" defaultValue={params.tipo ?? ""}>
          <option value="">Todos os tipos</option>
          {catalog.ok
            ? catalog.data.customerTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))
            : null}
        </select>
        <select className="h-12 rounded-xl border bg-card px-3" name="status" defaultValue={params.status ?? ""}>
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
        <select className="h-12 rounded-xl border bg-card px-3" name="fiado" defaultValue={params.fiado ?? ""}>
          <option value="">Fiado: todos</option>
          <option value="sim">Só fiado</option>
          <option value="nao">Sem fiado</option>
        </select>
        <button className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground" type="submit">
          Atualizar
        </button>
      </form>
      {!error ? (
        <div className="grid gap-4">
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
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <h2 className="px-4 pt-4 font-display text-2xl">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Qtd</th>
              <th className="px-4 py-3 font-medium">Faturamento</th>
              <th className="px-4 py-3 font-medium">Repasse</th>
              <th className="px-4 py-3 font-medium">Lucro</th>
              {showStock ? <th className="px-4 py-3 font-medium">Estoque</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 tabular-nums">{row.quantity}</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(row.revenue)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(row.transfer)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(row.profit)}</td>
                {showStock ? <td className="px-4 py-3 tabular-nums">{row.stock ?? 0}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
