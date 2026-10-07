import { Filter } from "lucide-react";
import { loadCatalog } from "@/lib/data/catalog";
import { listSales } from "@/lib/data/sales";
import { listBatches } from "@/lib/data/batches";
import { getSessionState } from "@/lib/auth";
import { PageHeading } from "@/components/shell/page-heading";
import { SaleList } from "@/components/sales/sale-list";
import { Notice } from "@/components/feedback/notice";
import { controlClass } from "@/components/ui/field";
import { IceFilterSelect } from "@/components/catalog/flavor-filters";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isConsultasRole } from "@/lib/domain/roles";

export const metadata = { title: "Vendas" };

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionState();
  const consultas = session.status === "ok" && isConsultasRole(session.profile.role_code);
  const [catalog, batches, sales] = await Promise.all([
    loadCatalog(),
    listBatches(),
    listSales({
      from: params.de,
      to: params.ate,
      productId: params.produto,
      customerTypeId: params.tipo,
      paymentStatusId: params.status,
      credit: consultas ? undefined : params.fiado,
      consultas,
      ice: params.ice,
      flavor: params.sabor,
      customer: params.cliente,
      situation: params.situacao,
      batchId: params.lote,
    }),
  ]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  const field = cn(controlClass, "h-11");

  return (
    <div className="w-full min-w-0">
      <PageHeading
        title="Vendas"
        eyebrow={sales.ok ? `${sales.sales.length} registro(s)` : undefined}
        description="Histórico com os valores praticados em cada venda."
        action={canWrite ? { href: "/vendas/nova", label: "Nova venda", icon: "plus" } : undefined}
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : null}

      <form className="tech-card mb-4 grid gap-2 p-3 md:p-4" method="get">
        <p className="eyebrow flex items-center gap-1.5">
          <Filter className="h-3 w-3" /> Filtros
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
          <input className={field} type="date" name="de" defaultValue={params.de ?? ""} aria-label="De" />
          <input className={field} type="date" name="ate" defaultValue={params.ate ?? ""} aria-label="Até" />
          <input
            className={cn(field, "sm:col-span-2")}
            name="cliente"
            placeholder="Cliente"
            defaultValue={params.cliente ?? ""}
          />
          {batches.ok ? (
            <select className={field} name="lote" defaultValue={params.lote ?? ""} aria-label="Lote">
              <option value="">Todos os lotes</option>
              {batches.batches.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>
                  Lote {String(batch.batch_number).padStart(3, "0")}{batch.is_legacy ? " · estoque legado" : ""}
                </option>
              ))}
            </select>
          ) : null}
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
          <select className={field} name="situacao" defaultValue={params.situacao ?? ""} aria-label="Situação">
            <option value="">Válidas</option>
            <option value="canceladas">Canceladas</option>
            <option value="todas">Todas</option>
          </select>
          <button className={cn(buttonVariants(), "h-11 w-full md:col-span-4")} type="submit">
            Filtrar
          </button>
        </div>
      </form>

      {!sales.ok ? <Notice>{sales.message}</Notice> : <SaleList sales={sales.sales} consultas={consultas} />}
    </div>
  );
}
