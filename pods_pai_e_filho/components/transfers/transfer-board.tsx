"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Clock, Send } from "lucide-react";
import { confirmTransfersAction } from "@/lib/actions/sales";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import type { SaleOverview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "agora", label: "A enviar agora" },
  { id: "futuro", label: "Repasses futuros" },
  { id: "pagos", label: "Já enviados" },
] as const;

export function TransferBoard({
  dueNow,
  future,
  paid,
  canWrite,
}: {
  dueNow: SaleOverview[];
  future: SaleOverview[];
  paid: SaleOverview[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("agora");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = tab === "agora" ? dueNow : tab === "futuro" ? future : paid;
  const counts = { agora: dueNow.length, futuro: future.length, pagos: paid.length };
  const dueTotal = dueNow.reduce((total, sale) => total + Number(sale.transfer_amount), 0);
  const futureTotal = future.reduce((total, sale) => total + Number(sale.transfer_amount), 0);
  const selectedTotal = dueNow
    .filter((sale) => selected.includes(sale.id))
    .reduce((total, sale) => total + Number(sale.transfer_amount), 0);
  const allSelected = dueNow.length > 0 && selected.length === dueNow.length;

  function toggle(id: string) {
    setSelected((currentIds) =>
      currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id],
    );
  }

  function confirm(ids: string[]) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await confirmTransfersAction(ids, notes);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSelected([]);
      setNotes("");
      setMessage("Repasse registrado. Os valores saíram de “A enviar ao pai agora”.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="stagger grid grid-cols-2 gap-3">
        <StatCard label="A enviar ao pai agora" value={dueTotal} icon={Send} featured hint={`${dueNow.length} venda(s)`} />
        <StatCard label="Repasse futuro" value={futureTotal} icon={Clock} tone="info" hint={`${future.length} venda(s)`} />
      </div>

      <div className="segmented w-full">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            data-active={tab === item.id}
            className="segmented-item flex-1 gap-1.5 px-2"
          >
            <span className="truncate">{item.label}</span>
            <span
              className={cn(
                "rounded px-1.5 text-[10px] font-bold tabular-nums",
                tab === item.id ? "bg-primary-foreground/20" : "bg-surface-2 text-muted-foreground",
              )}
            >
              {counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      {tab === "agora" && canWrite && dueNow.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked === true ? dueNow.map((sale) => sale.id) : [])}
              aria-label="Selecionar todas"
            />
            <span className="text-muted-foreground">Selecionar todas</span>
          </label>
          <span className="text-muted-foreground">
            {selected.length} selecionada(s) ·{" "}
            <span className="font-medium tabular-nums text-foreground">{formatBRL(selectedTotal)}</span>
          </span>
        </div>
      ) : null}

      {current.length === 0 ? (
        <EmptyState title="Nada nesta lista" />
      ) : (
        <div key={tab} className="stagger grid gap-2">
          {current.map((sale) => {
            const checked = selected.includes(sale.id);
            return (
              <article
                key={sale.id}
                className={cn(
                  "tech-card p-4 transition-[border-color,box-shadow]",
                  checked && "border-primary/60 shadow-glow-sm",
                )}
              >
                <div className="flex items-start gap-3">
                  {tab === "agora" && canWrite ? (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(sale.id)}
                      className="mt-1"
                      aria-label={`Selecionar venda de ${sale.customer_name}`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{sale.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(sale.sale_date)} · {sale.product_name} · {sale.variant_name} ·{" "}
                          {sale.customer_type_name}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 font-display text-lg font-bold tabular-nums",
                          tab === "agora" && "text-primary",
                          tab === "pagos" && "text-success",
                        )}
                      >
                        {formatBRL(sale.transfer_amount)}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Venda {formatBRL(sale.total_amount)}</span>
                      {sale.is_credit ? <Badge variant="danger">Fiado</Badge> : null}
                      {sale.transfer_paid_at ? (
                        <Badge variant="success">pago em {formatDateTime(sale.transfer_paid_at)}</Badge>
                      ) : null}
                    </div>
                    {tab === "agora" && canWrite ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        disabled={pending}
                        onClick={() => confirm([sale.id])}
                      >
                        <CheckCheck />
                        Marcar como pago
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "agora" && canWrite && dueNow.length > 0 ? (
        <div className="tech-card tech-card-accent grid gap-3 p-4 md:sticky md:bottom-4">
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observação do repasse, se quiser"
            className="min-h-20"
          />
          <Button
            type="button"
            size="lg"
            disabled={pending || selected.length === 0}
            onClick={() => confirm(selected)}
          >
            <Send />
            {pending
              ? "Registrando..."
              : selected.length > 0
                ? `Pagar selecionados (${selected.length}) · ${formatBRL(selectedTotal)}`
                : "Selecione as vendas para pagar"}
          </Button>
        </div>
      ) : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
