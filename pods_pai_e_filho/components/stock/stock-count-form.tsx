"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyStockCountAction, registerStockCountAction } from "@/lib/actions/stock";
import type { StockBalance } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Badge } from "@/components/ui/badge";
import { FlavorLabel } from "@/components/sales/badges";
import { cn } from "@/lib/utils";

export function StockCountForm({
  stock,
  canWrite,
}: {
  stock: StockBalance[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const rows = stock.filter((item) => item.variant_active && item.product_active);
  const [physical, setPhysical] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((item) => [item.variant_id, String(item.quantity)])),
  );
  const [notes, setNotes] = useState("");
  const [countId, setCountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const divergent = rows.filter(
    (item) => Number(physical[item.variant_id] ?? 0) - item.quantity !== 0,
  ).length;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await registerStockCountAction({
            notes,
            lines: rows.map((item) => ({
              variantId: item.variant_id,
              physicalQuantity: Number(physical[item.variant_id] ?? 0),
            })),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setCountId(result.id ?? null);
          setMessage("Conferência registrada. Se houver diferença, você pode lançar o ajuste.");
          router.refresh();
        });
      }}
    >
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">{rows.length} sabores para conferir</span>
        {divergent > 0 ? (
          <Badge variant="warning" dot>
            {divergent} divergência(s)
          </Badge>
        ) : (
          <Badge variant="success">Tudo confere</Badge>
        )}
      </div>

      <div className="stagger grid gap-3 md:grid-cols-2">
        {rows.map((item) => {
          const informed = Number(physical[item.variant_id] ?? 0);
          const difference = informed - item.quantity;
          const ok = difference === 0;
          return (
            <article
              key={item.variant_id}
              className={cn(
                "tech-card p-4 transition-colors",
                !ok && "border-warning/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow text-[10px]">{item.product_name}</p>
                  <div className="font-display font-semibold">
                    <FlavorLabel name={item.variant_name} isIce={item.variant_is_ice} />
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 font-display text-sm font-bold tabular-nums",
                    ok
                      ? "border-success/35 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning",
                  )}
                >
                  {ok ? "OK" : difference > 0 ? `+${difference}` : difference}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-border bg-surface px-3 py-2">
                  <p className="eyebrow text-[10px]">Calculado</p>
                  <p className="mt-1 font-display text-xl font-bold tabular-nums">{item.quantity}</p>
                </div>
                <label className="col-span-2">
                  <span className="eyebrow text-[10px]">Físico</span>
                  <Input
                    className="mt-1 h-12 font-display text-lg font-semibold"
                    inputMode="numeric"
                    min={0}
                    type="number"
                    value={physical[item.variant_id] ?? ""}
                    onChange={(event) =>
                      setPhysical((current) => ({ ...current, [item.variant_id]: event.target.value }))
                    }
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
      <TextArea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Observação da conferência"
      />
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" size="lg" disabled={!canWrite || pending}>
          {pending ? "Salvando..." : "Registrar conferência"}
        </Button>
        {countId && canWrite ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await applyStockCountAction(countId);
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                setMessage("Ajustes lançados. O estoque calculado foi alinhado à contagem.");
                setCountId(null);
                router.refresh();
              });
            }}
          >
            Lançar ajustes das divergências
          </Button>
        ) : null}
      </div>
    </form>
  );
}
