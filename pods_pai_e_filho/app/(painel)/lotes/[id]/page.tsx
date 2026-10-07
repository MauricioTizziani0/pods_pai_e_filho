import { getSessionState } from "@/lib/auth";
import { getBatchDetails } from "@/lib/data/batches";
import { formatBRL, formatDate } from "@/lib/format";
import type { BatchOverview } from "@/lib/types";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { CancelBatchButton } from "@/components/stock/cancel-batch-button";

export const metadata = { title: "Detalhes do lote" };

function batchLabel(number: number) {
  return "Lote " + String(number).padStart(3, "0");
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-3">
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="mt-1 break-words font-display text-lg font-bold tabular-nums sm:text-xl">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function FinancialMetrics({ batch, admin }: { batch: BatchOverview; admin: boolean }) {
  const rows: Array<{ label: string; value: string; note?: string }> = [
    { label: "Capital investido", value: formatBRL(batch.capital_invested) },
    { label: "Capital em estoque", value: formatBRL(batch.capital_in_stock) },
    { label: "Capital recuperado", value: formatBRL(batch.capital_recovered) },
    { label: admin ? "Repasse total ao pai" : "Meu repasse total", value: formatBRL(batch.transfer_total) },
    { label: "Já repassado", value: formatBRL(batch.transfer_paid) },
    { label: "A enviar agora", value: formatBRL(batch.transfer_due_now) },
    { label: "Repasse futuro", value: formatBRL(batch.transfer_future) },
    { label: admin ? "Lucro do pai" : "Meu lucro", value: formatBRL(batch.father_profit) },
  ];
  if (admin) rows.splice(3, 0,
    { label: "Faturamento vendido", value: formatBRL(batch.revenue) },
    { label: "Venda recebida", value: formatBRL(batch.revenue_received) },
    { label: "A receber do cliente", value: formatBRL(batch.revenue_receivable) },
    { label: "Lucro do filho", value: formatBRL(batch.child_profit) },
    { label: "Lucro total", value: formatBRL(batch.total_profit) },
  );
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <Metric key={row.label} {...row} />)}</div>;
}

export default async function LoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, getSessionState()]);
  if (session.status !== "ok") return <Notice>Não foi possível carregar seu perfil.</Notice>;
  const result = await getBatchDetails(id);
  if (!result.ok) return <Notice>{result.message.includes("batch") || result.message.includes("schema") ? "Execute a migration de lotes no Supabase para habilitar esta tela." : result.message}</Notice>;
  const { batch, items } = result;
  const admin = session.profile.can_write;
  const canCancel = admin && batch.status === "ABERTO" && !batch.has_sales &&
    batch.total_purchased === batch.quantity_remaining;

  return (
    <div className="grid w-full min-w-0 gap-5">
      <PageHeading
        title={batchLabel(batch.batch_number)}
        eyebrow={batch.is_legacy ? "Saldo antigo associado" : "Detalhes do ciclo de compra"}
        back={{ href: "/lotes", label: "Voltar aos lotes" }}
        description={(batch.is_legacy ? "Estoque legado associado em " : "Compra em ") + formatDate(batch.purchase_date)}
      >
        {batch.is_legacy ? <Badge variant="info">ESTOQUE LEGADO</Badge> : null}
        <Badge variant={batch.status === "ABERTO" ? "warning" : batch.status === "FINALIZADO" ? "success" : "neutral"}>{batch.status}</Badge>
        {canCancel ? <CancelBatchButton batchId={batch.batch_id} isLegacy={batch.is_legacy} /> : null}
      </PageHeading>

      <Panel title="Movimento do lote" description={batch.notes || undefined}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Unidades compradas" value={batch.total_purchased} />
          <Metric label="Unidades vendidas" value={batch.quantity_sold} />
          <Metric label="Unidades restantes" value={batch.quantity_remaining} />
        </div>
        {batch.status === "FINALIZADO" ? (
          <p className="mt-3 rounded-md border border-success/35 bg-success/10 px-3 py-2 text-sm text-success">
            Lote encerrado{batch.closed_at ? " em " + formatDate(batch.closed_at) : ""}.
            {batch.duration_days != null ? " Giro concluído em " + batch.duration_days + (batch.duration_days === 1 ? " dia." : " dias.") : ""}
          </p>
        ) : null}
      </Panel>

      <Panel title="Resumo financeiro" description="Custos e valores de venda são snapshots das unidades alocadas ao lote.">
        <FinancialMetrics batch={batch} admin={admin} />
      </Panel>

      <Panel title={batch.is_legacy ? "Itens associados" : "Itens da compra"} description="Saldo e custo por produto e variação">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Este lote não possui itens.</p> : (
          <div className="grid gap-3">
            {items.map((item) => (
              <div key={item.batch_item_id} className="grid min-w-0 gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{item.product_name}</p>
                  <p className="break-words text-sm text-muted-foreground">{item.variant_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Custo histórico: {formatBRL(item.unit_cost)} / unidade</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-sm">
                  <p><span className="block text-xs text-muted-foreground">Comprados</span><strong>{item.quantity_purchased}</strong></p>
                  <p><span className="block text-xs text-muted-foreground">Vendidos</span><strong>{item.quantity_sold}</strong></p>
                  <p><span className="block text-xs text-muted-foreground">Restantes</span><strong>{item.quantity_remaining}</strong></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
