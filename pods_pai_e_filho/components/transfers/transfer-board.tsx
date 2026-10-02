"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCheck, Clock, Send, HandCoins, TrendingUp } from "lucide-react";
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
  consultas = false,
  receivedTotal = 0,
  fatherProfitReceived = 0,
  fatherProfitMissingItems = 0,
}: {
  dueNow: SaleOverview[];
  future: SaleOverview[];
  paid: SaleOverview[];
  canWrite: boolean;
  consultas?: boolean;
  receivedTotal?: number;
  fatherProfitReceived?: number;
  fatherProfitMissingItems?: number;
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
  const visibleTabs = tabs.map((item) => consultas
    ? { ...item, label: item.id === "agora" ? "A receber agora" : item.id === "futuro" ? "A receber futuramente" : "Já recebidos" }
    : item);
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
    <div className="grid w-full min-w-0 gap-4">
      {consultas ? (
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="A receber agora" value={dueTotal} icon={Send} featured hint={`${dueNow.length} venda(s)`} />
          <StatCard label="A receber futuramente" value={futureTotal} icon={Clock} tone="info" hint={`${future.length} venda(s)`} />
          <StatCard label="Total já recebido" value={receivedTotal} icon={HandCoins} tone="success" hint="Repasses marcados como pagos" />
          {fatherProfitMissingItems > 0 ? (
            <article className="tech-card w-full min-w-0 p-4">
              <p className="eyebrow break-words">Lucro já recebido</p>
              <p className="mt-3 break-words font-display text-xl font-bold text-warning sm:text-2xl">Dados incompletos</p>
              <p className="mt-2 break-words text-xs text-muted-foreground">{fatherProfitMissingItems} item(ns) sem custo histórico.</p>
            </article>
          ) : <StatCard label="Lucro já recebido" value={fatherProfitReceived} icon={TrendingUp} tone="success" hint="Lucro incluído nos repasses recebidos" />}
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label="A enviar ao pai agora" value={dueTotal} icon={Send} featured hint={`${dueNow.length} venda(s)`} />
          <StatCard label="Repasse futuro" value={futureTotal} icon={Clock} tone="info" hint={`${future.length} venda(s)`} />
        </div>
      )}

      <div className="segmented w-full min-w-0 max-w-full">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            data-active={tab === item.id}
            className="segmented-item shrink-0 gap-1.5 px-2.5 text-xs sm:flex-1 sm:px-2 sm:text-sm"
          >
            <span className="whitespace-nowrap">{item.label}</span>
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
        <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked === true ? dueNow.map((sale) => sale.id) : [])}
              aria-label="Selecionar todas"
            />
            <span className="text-muted-foreground">Selecionar todas</span>
          </label>
          <span className="min-w-0 break-words text-muted-foreground">
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
                  "tech-card min-w-0 p-4 transition-[border-color,box-shadow]",
                  checked && "border-primary/60 shadow-glow-sm",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {tab === "agora" && canWrite ? (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(sale.id)}
                      className="mt-1 shrink-0"
                      aria-label={`Selecionar venda de ${sale.customer_name}`}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="min-w-0 break-words font-semibold">{sale.customer_name}</p>
                      <p
                        className={cn(
                          "shrink-0 text-right font-display text-base font-bold tabular-nums sm:text-lg",
                          tab === "agora" && "text-primary",
                          tab === "pagos" && "text-success",
                        )}
                      >
                        {formatBRL(sale.transfer_amount)}
                      </p>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="block sm:inline">{formatDate(sale.sale_date)}</span>
                      <span className="hidden sm:inline"> · </span>
                      <span className="block min-w-0 break-words sm:inline">{sale.product_name}</span>
                      <span className="hidden sm:inline"> · </span>
                      <span className="block min-w-0 break-words sm:inline">{sale.variant_name}</span>
                      <span className="hidden sm:inline"> · </span>
                      <span className="block sm:inline">{sale.customer_type_name}</span>
                    </div>
                    {consultas ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 text-xs sm:grid-cols-2">
                        <span className="min-w-0 break-words text-muted-foreground">Custo: <strong className="text-foreground">{sale.cost_history_missing ? "Custo histórico não informado" : formatBRL(sale.cost_amount)}</strong></span>
                        <span className="min-w-0 break-words text-muted-foreground">Venda: <strong className="text-foreground">{formatBRL(sale.total_amount)}</strong></span>
                        <span className="min-w-0 break-words text-muted-foreground">Meu repasse: <strong className="text-primary">{formatBRL(sale.transfer_amount)}</strong></span>
                        <span className="min-w-0 break-words text-muted-foreground">Meu lucro: <strong className="text-success">{sale.cost_history_missing ? "Custo histórico não informado" : formatBRL(sale.father_profit_amount)}</strong></span>
                      </div>
                    ) : null}
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="break-words">Venda {formatBRL(sale.total_amount)}</span>
                      {!consultas && sale.is_credit ? <Badge variant="danger">Fiado</Badge> : null}
                      {sale.transfer_paid_at ? (
                        <Badge variant="success">{consultas ? "recebido em" : "pago em"} {formatDateTime(sale.transfer_paid_at)}</Badge>
                      ) : null}
                    </div>
                    {tab === "agora" && canWrite ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full sm:w-auto"
                        disabled={pending}
                        onClick={() => confirm([sale.id])}
                      >
                        <CheckCheck />
                        Marcar como pago
                      </Button>
                    ) : null}
                    {consultas ? <Link href={`/vendas/${sale.id}`} className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">Ver venda</Link> : null}
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
            className="h-auto min-h-12 w-full whitespace-normal"
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
