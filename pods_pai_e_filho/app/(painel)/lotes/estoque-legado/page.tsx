import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { LegacyStockForm } from "@/components/stock/legacy-stock-form";

export const metadata = { title: "Associar estoque legado" };

export default async function EstoqueLegadoPage() {
  const [session, catalog] = await Promise.all([getSessionState(), loadCatalog()]);
  if (session.status !== "ok" || session.profile.role_code.toLowerCase() !== "admin") redirect("/lotes");
  return (
    <div className="grid w-full min-w-0 gap-5">
      <PageHeading
        title="Associar estoque legado"
        eyebrow="Migração controlada"
        back={{ href: "/lotes", label: "Voltar aos lotes" }}
        description="Opcional: associe saldo antigo a um lote identificado como legado quando conhecer seu custo histórico."
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : (
        <LegacyStockForm stock={catalog.data.stock} variants={catalog.data.variants} batchItems={catalog.data.batchItems ?? []} />
      )}
    </div>
  );
}
