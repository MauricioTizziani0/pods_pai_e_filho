import { loadCatalog } from "@/lib/data/catalog";
import { listSales } from "@/lib/data/sales";
import { getSessionState } from "@/lib/auth";
import { PageHeading } from "@/components/shell/page-heading";
import { SaleList } from "@/components/sales/sale-list";
import { Notice } from "@/components/feedback/notice";

export const metadata = { title: "Vendas" };

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [catalog, sales, session] = await Promise.all([
    loadCatalog(),
    listSales({
      from: params.de,
      to: params.ate,
      productId: params.produto,
      customerTypeId: params.tipo,
      paymentStatusId: params.status,
      credit: params.fiado,
      customer: params.cliente,
      situation: params.situacao,
    }),
    getSessionState(),
  ]);
  const canWrite = session.status === "ok" && session.profile.can_write;

  return (
    <div>
      <PageHeading
        title="Vendas"
        description="Histórico com os valores praticados em cada venda."
        action={canWrite ? { href: "/vendas/nova", label: "Nova venda" } : undefined}
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : null}
      <form className="mb-4 grid gap-2 md:grid-cols-4" method="get">
        <input className="h-12 rounded-xl border bg-card px-3" type="date" name="de" defaultValue={params.de ?? ""} aria-label="De" />
        <input className="h-12 rounded-xl border bg-card px-3" type="date" name="ate" defaultValue={params.ate ?? ""} aria-label="Até" />
        <input className="h-12 rounded-xl border bg-card px-3" name="cliente" placeholder="Cliente" defaultValue={params.cliente ?? ""} />
        <select className="h-12 rounded-xl border bg-card px-3" name="produto" defaultValue={params.produto ?? ""} aria-label="Produto">
          <option value="">Todos os produtos</option>
          {catalog.ok
            ? catalog.data.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))
            : null}
        </select>
        <select className="h-12 rounded-xl border bg-card px-3" name="tipo" defaultValue={params.tipo ?? ""} aria-label="Tipo de cliente">
          <option value="">Todos os tipos</option>
          {catalog.ok
            ? catalog.data.customerTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))
            : null}
        </select>
        <select className="h-12 rounded-xl border bg-card px-3" name="status" defaultValue={params.status ?? ""} aria-label="Status">
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
        <select className="h-12 rounded-xl border bg-card px-3" name="fiado" defaultValue={params.fiado ?? ""} aria-label="Fiado">
          <option value="">Fiado: todos</option>
          <option value="sim">Só fiado</option>
          <option value="nao">Sem fiado</option>
        </select>
        <select className="h-12 rounded-xl border bg-card px-3" name="situacao" defaultValue={params.situacao ?? ""} aria-label="Situação">
          <option value="">Válidas</option>
          <option value="canceladas">Canceladas</option>
          <option value="todas">Todas</option>
        </select>
        <button className="h-12 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground md:col-span-4" type="submit">
          Filtrar
        </button>
      </form>
      {!sales.ok ? <Notice>{sales.message}</Notice> : <SaleList sales={sales.sales} />}
    </div>
  );
}
