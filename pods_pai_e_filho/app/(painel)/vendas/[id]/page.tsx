import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { getSale } from "@/lib/data/sales";
import { formatDate, shortId } from "@/lib/format";
import { Notice } from "@/components/feedback/notice";
import { SaleEditor } from "@/components/sales/sale-editor";

export const metadata = { title: "Venda" };

export default async function VendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sale, catalog, session] = await Promise.all([
    getSale(id),
    loadCatalog(),
    getSessionState(),
  ]);

  if (!sale.ok) {
    if (sale.message === "Venda não encontrada.") notFound();
    return <Notice>{sale.message}</Notice>;
  }
  if (!catalog.ok) return <Notice>{catalog.message}</Notice>;

  const canWrite = session.status === "ok" && session.profile.can_write;

  return (
    <div>
      <Link href="/vendas" className="text-sm text-muted-foreground">
        Voltar às vendas
      </Link>
      <h1 className="mt-2 font-display text-3xl">
        {sale.sale.customer_name}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDate(sale.sale.sale_date)} · {sale.sale.product_name} · {sale.sale.variant_name} · #{shortId(sale.sale.id)}
      </p>
      <div className="mt-5">
        <SaleEditor sale={sale.sale} catalog={catalog.data} audit={sale.audit} canWrite={canWrite} />
      </div>
    </div>
  );
}
