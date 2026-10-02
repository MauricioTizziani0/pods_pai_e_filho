import { getSessionState } from "@/lib/auth";
import { listSales } from "@/lib/data/sales";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { TransferBoard } from "@/components/transfers/transfer-board";
import { loadConsultasFinancialSummary } from "@/lib/data/dashboard";

export const metadata = { title: "Repasses" };

export default async function RepassesPage() {
  const [dueNow, future, paid, session] = await Promise.all([
    listSales({ dueNow: true, limit: 300 }),
    listSales({ future: true, limit: 300 }),
    listSales({ paid: true, limit: 300 }),
    getSessionState(),
  ]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  const consultas = session.status === "ok" && !session.profile.can_write;
  const error = [dueNow, future, paid].find((result) => !result.ok);
  const summary = consultas ? await loadConsultasFinancialSummary(null, null) : null;

  return (
    <div className="w-full min-w-0">
      <PageHeading
        title={consultas ? "Financeiro" : "Repasses"}
        eyebrow="Financeiro"
        description={consultas ? "Acompanhe seus repasses pendentes e recebidos." : "A enviar agora junta venda recebida ou fiada cujo repasse ainda não foi pago."}
      />
      {error && !error.ok ? (
        <Notice>{error.message}</Notice>
      ) : summary && !summary.ok ? (
        <Notice>{summary.message}</Notice>
      ) : (
        <TransferBoard
          dueNow={dueNow.sales}
          future={future.sales}
          paid={paid.sales}
          canWrite={canWrite}
          consultas={consultas}
          receivedTotal={summary?.ok ? Number(summary.summary.transfer_received) : 0}
          fatherProfitReceived={summary?.ok ? Number(summary.summary.father_profit_received) : 0}
          fatherProfitMissingItems={summary?.ok ? Number(summary.summary.father_profit_missing_received_items) : 0}
        />
      )}
    </div>
  );
}
