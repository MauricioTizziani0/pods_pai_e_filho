import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { SaleForm } from "@/components/sales/sale-form";

export const metadata = { title: "Nova venda" };

export default async function NovaVendaPage() {
  const [catalog, session] = await Promise.all([loadCatalog(), getSessionState()]);
  const canWrite = session.status === "ok" && session.profile.can_write;

  return (
    <div>
      <PageHeading
        title="Nova venda"
        description="O preço e o repasse vêm da tabela atual. O lucro é calculado e fica gravado na venda."
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : <SaleForm catalog={catalog.data} canWrite={canWrite} />}
    </div>
  );
}
