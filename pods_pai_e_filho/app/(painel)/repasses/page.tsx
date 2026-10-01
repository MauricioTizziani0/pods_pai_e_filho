import { getSessionState } from "@/lib/auth";
import { listSales } from "@/lib/data/sales";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { TransferBoard } from "@/components/transfers/transfer-board";

export const metadata = { title: "Repasses" };

export default async function RepassesPage() {
  const [dueNow, future, paid, session] = await Promise.all([
    listSales({ dueNow: true, limit: 300 }),
    listSales({ future: true, limit: 300 }),
    listSales({ paid: true, limit: 300 }),
    getSessionState(),
  ]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  const error = [dueNow, future, paid].find((result) => !result.ok);

  return (
    <div>
      <PageHeading
        title="Repasses"
        eyebrow="Financeiro"
        description="A enviar agora junta venda recebida ou fiada cujo repasse ainda não foi pago."
      />
      {error && !error.ok ? (
        <Notice>{error.message}</Notice>
      ) : (
        <TransferBoard
          dueNow={dueNow.sales}
          future={future.sales}
          paid={paid.sales}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
