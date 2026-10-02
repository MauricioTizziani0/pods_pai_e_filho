import { notFound } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { getSale } from "@/lib/data/sales";
import { formatDate, shortId } from "@/lib/format";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { SaleEditor } from "@/components/sales/sale-editor";
import { isConsultasRole } from "@/lib/domain/roles";

export const metadata = { title: "Venda" };

export default async function VendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionState();
  const consultas = session.status === "ok" && isConsultasRole(session.profile.role_code);
  const [sale, catalog] = await Promise.all([
    getSale(id, consultas),
    loadCatalog(),
  ]);

  if (!sale.ok) {
    if (sale.message === "Venda não encontrada.") notFound();
    return <Notice>{sale.message}</Notice>;
  }
  if (!catalog.ok) return <Notice>{catalog.message}</Notice>;

  const canWrite = session.status === "ok" && session.profile.can_write;

  return (
    <div className="w-full min-w-0">
      <PageHeading
        title={sale.sale.customer_name}
        eyebrow={`Venda #${shortId(sale.sale.id)}`}
        back={{ href: "/vendas", label: "Voltar às vendas" }}
        description={`${formatDate(sale.sale.sale_date)} · ${sale.sale.product_name} · ${sale.sale.variant_name}`}
      />
      <SaleEditor sale={sale.sale} items={sale.items} catalog={catalog.data} audit={sale.audit} canWrite={canWrite} consultas={consultas} />
    </div>
  );
}
