import { getSessionState } from "@/lib/auth";
import { listSales } from "@/lib/data/sales";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { TransferBoard } from "@/components/transfers/transfer-board";
import { loadConsultasFinancialSummary } from "@/lib/data/dashboard";
import { isConsultasRole } from "@/lib/domain/roles";

export const metadata = { title: "Repasses" };

export default async function RepassesPage() {
  const session = await getSessionState();
  const consultas = session.status === "ok" && isConsultasRole(session.profile.role_code);
  const [dueNow, future, paid] = await Promise.all([
    listSales({ dueNow: true, limit: 300, consultas }),
    listSales({ future: true, limit: 300, consultas }),
    listSales({ paid: true, limit: 300, consultas }),
  ]);
  const canWrite = session.status === "ok" && session.profile.can_write;
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
