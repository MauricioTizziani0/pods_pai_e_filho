"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerStockMovementAction } from "@/lib/actions/stock";
import { todayInBrazil } from "@/lib/format";
import type { StockBalance } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";

export function StockEntryForm({
  stock,
  canWrite,
}: {
  stock: StockBalance[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const options = stock.filter((item) => item.variant_active && item.product_active);
  const [variantId, setVariantId] = useState(options[0]?.variant_id ?? "");
  const [type, setType] = useState("ENTRADA");
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(todayInBrazil());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = new Map<string, StockBalance[]>();
  for (const item of options) {
    const list = groups.get(item.product_name) ?? [];
    list.push(item);
    groups.set(item.product_name, list);
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await registerStockMovementAction({
            variantId,
            type,
            quantity,
            date,
            notes,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setMessage("Movimentação registrada.");
          setQuantity(1);
          setNotes("");
          router.refresh();
        });
      }}
    >
      <h2 className="font-display text-xl">Lançar estoque</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sabor" className="md:col-span-2">
          <Select value={variantId} onChange={(event) => setVariantId(event.target.value)} required>
            {[...groups.entries()].map(([product, items]) => (
              <optgroup key={product} label={product}>
                {items.map((item) => (
                  <option key={item.variant_id} value={item.variant_id}>
                    {item.variant_name} · {item.quantity} un
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="ENTRADA">Entrada</option>
            <option value="AJUSTE_ENTRADA">Ajuste de entrada</option>
            <option value="AJUSTE_SAIDA">Ajuste de saída</option>
          </Select>
        </Field>
        <Field label="Quantidade">
          <Input
            className="h-12 rounded-xl text-base"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            required
          />
        </Field>
        <Field label="Data">
          <Input className="h-12 rounded-xl text-base" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label="Observação" className="md:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" className="h-12 rounded-xl" disabled={!canWrite || pending || !variantId}>
        {pending ? "Salvando..." : "Registrar movimentação"}
      </Button>
    </form>
  );
}
