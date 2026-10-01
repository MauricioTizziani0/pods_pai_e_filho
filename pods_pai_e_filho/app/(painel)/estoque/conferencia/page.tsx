import Link from "next/link";
import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { StockCountForm } from "@/components/stock/stock-count-form";

export const metadata = { title: "Conferência" };

export default async function ConferenciaPage() {
  const [catalog, session] = await Promise.all([loadCatalog(), getSessionState()]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  return (
    <div>
      <Link href="/estoque" className="text-sm text-muted-foreground">
        Voltar ao estoque
      </Link>
      <h1 className="mt-2 font-display text-3xl">Conferência</h1>
      <p className="mt-2 mb-5 max-w-xl text-sm text-muted-foreground">
        Compare o saldo calculado com a contagem física. A diferença não altera o estoque até você lançar o ajuste.
      </p>
      {!catalog.ok ? (
        <Notice>{catalog.message}</Notice>
      ) : (
        <StockCountForm stock={catalog.data.stock} canWrite={canWrite} />
      )}
    </div>
  );
}
