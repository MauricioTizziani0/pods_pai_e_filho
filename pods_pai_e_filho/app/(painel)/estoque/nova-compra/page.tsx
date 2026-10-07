import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { PurchaseForm } from "@/components/stock/purchase-form";

export const metadata = { title: "Nova compra" };

export default async function NovaCompraPage() {
  const [catalog, session] = await Promise.all([loadCatalog(), getSessionState()]);
  if (session.status !== "ok" || !session.profile.can_write) redirect("/estoque");
  return (
    <div className="grid w-full min-w-0 gap-5">
      <PageHeading
        title="Nova compra"
        eyebrow="Compra e entrada de estoque"
        back={{ href: "/estoque", label: "Voltar ao estoque" }}
        description="Cada compra independente gera um lote novo, mesmo quando ainda há unidades de compras anteriores."
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : <PurchaseForm catalog={catalog.data} />}
    </div>
  );
}
