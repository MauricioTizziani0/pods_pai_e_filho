"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyStockCountAction, registerStockCountAction } from "@/lib/actions/stock";
import type { StockBalance } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";

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
      <div className="grid gap-3">
        {rows.map((item) => {
          const informed = Number(physical[item.variant_id] ?? 0);
          const difference = informed - item.quantity;
          return (
            <article key={item.variant_id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">{item.variant_name}</p>
                </div>
                <p className={difference === 0 ? "text-sm text-emerald-800" : "text-sm font-semibold text-amber-800"}>
                  {difference === 0 ? "OK" : difference > 0 ? `+${difference}` : difference}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Calculado</p>
                  <p className="tabular-nums text-lg font-semibold">{item.quantity}</p>
                </div>
                <label className="col-span-2">
                  <span className="text-muted-foreground">Físico</span>
                  <Input
                    className="mt-1 h-12 rounded-xl text-base"
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
      <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação da conferência" />
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" className="h-12 rounded-xl" disabled={!canWrite || pending}>
        {pending ? "Salvando..." : "Registrar conferência"}
      </Button>
      {countId && canWrite ? (
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
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
    </form>
  );
}
