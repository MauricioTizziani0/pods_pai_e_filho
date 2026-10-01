"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmTransfersAction } from "@/lib/actions/sales";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import type { SaleOverview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { EmptyState } from "@/components/ui/empty-state";
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
  const dueTotal = dueNow.reduce((total, sale) => total + Number(sale.transfer_amount), 0);
  const futureTotal = future.reduce((total, sale) => total + Number(sale.transfer_amount), 0);

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
      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-2xl border bg-orange-50 p-4">
          <p className="text-sm text-orange-950/80">A enviar agora</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(dueTotal)}</p>
        </article>
        <article className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Repasse futuro</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(futureTotal)}</p>
        </article>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-11 rounded-xl px-2 text-sm font-medium",
              tab === item.id ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <EmptyState title="Nada nesta lista" />
      ) : (
        <div className="grid gap-3">
          {current.map((sale) => (
            <article key={sale.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                {tab === "agora" && canWrite ? (
                  <Checkbox
                    checked={selected.includes(sale.id)}
                    onCheckedChange={() => toggle(sale.id)}
                    className="mt-1 h-5 w-5"
                    aria-label={`Selecionar venda de ${sale.customer_name}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{sale.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(sale.sale_date)} · {sale.product_name} · {sale.variant_name} ·{" "}
                        {sale.customer_type_name}
                      </p>
                    </div>
                    <p className="tabular-nums font-semibold">{formatBRL(sale.transfer_amount)}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Venda {formatBRL(sale.total_amount)}
                    {sale.is_credit ? " · Fiado" : ""}
                    {sale.transfer_paid_at ? ` · pago em ${formatDateTime(sale.transfer_paid_at)}` : ""}
                  </p>
                  {tab === "agora" && canWrite ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 h-10 rounded-xl"
                      disabled={pending}
                      onClick={() => confirm([sale.id])}
                    >
                      Marcar como pago
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "agora" && canWrite && dueNow.length > 0 ? (
        <div className="grid gap-3 rounded-2xl border bg-card p-4">
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observação do repasse, se quiser"
          />
          <Button
            type="button"
            className="h-12 rounded-xl"
            disabled={pending || selected.length === 0}
            onClick={() => confirm(selected)}
          >
            {pending ? "Registrando..." : `Pagar selecionados (${selected.length})`}
          </Button>
        </div>
      ) : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
