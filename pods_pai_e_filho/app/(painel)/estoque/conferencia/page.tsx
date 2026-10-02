import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { StockCountForm } from "@/components/stock/stock-count-form";
import { redirect } from "next/navigation";

export const metadata = { title: "Conferência" };

export default async function ConferenciaPage() {
  const [catalog, session] = await Promise.all([loadCatalog(), getSessionState()]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  if (!canWrite) redirect("/estoque");
  return (
    <div className="w-full min-w-0">
      <PageHeading
        title="Conferência"
        eyebrow="Estoque"
        back={{ href: "/estoque", label: "Voltar ao estoque" }}
        description="Compare o saldo calculado com a contagem física. A diferença não altera o estoque até você lançar o ajuste."
      />
      {!catalog.ok ? (
        <Notice>{catalog.message}</Notice>
      ) : (
        <StockCountForm stock={catalog.data.stock} canWrite={canWrite} />
      )}
    </div>
  );
}
