"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createLegacyBatchAction } from "@/lib/actions/stock";
import { formatBRL } from "@/lib/format";
import { getFlavorDisplayName } from "@/lib/domain/flavors";
import type { BatchItemOverview, ProductVariant, StockBalance } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Panel } from "@/components/ui/panel";

type LegacyOption = StockBalance & { unassigned: number };
type LegacyLine = { key: string; variantId: string; quantity: number; unitCost: string };

export function LegacyStockForm({
  stock,
  variants,
  batchItems,
}: {
  stock: StockBalance[];
  variants: ProductVariant[];
  batchItems: BatchItemOverview[];
}) {
  const router = useRouter();
  const options: LegacyOption[] = stock
    .filter((balance) => balance.variant_active && balance.product_active && variants.some((variant) => variant.id === balance.variant_id && variant.active))
    .map((balance) => {
      const assigned = batchItems.filter((item) => item.variant_id === balance.variant_id)
        .reduce((sum, item) => sum + item.quantity_remaining, 0);
      return { ...balance, unassigned: Math.max(0, balance.quantity - assigned) };
    })
    .filter((balance) => balance.unassigned > 0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LegacyLine[]>(options[0] ? [{
    key: "first", variantId: options[0].variant_id, quantity: 1, unitCost: "",
  }] : []);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalCost = lines.reduce((sum, line) => sum + (Number(line.unitCost) || 0) * line.quantity, 0);

  function update(index: number, change: Partial<LegacyLine>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...change } : line));
    setReview(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!review) {
      if (!lines.length || lines.some((line) => !line.variantId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.unitCost.trim() === "" || !Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0)) {
        setError("Informe quantidade e custo histórico conhecido para cada sabor.");
        return;
      }
      setReview(true);
      return;
    }
    startTransition(async () => {
      const result = await createLegacyBatchAction({
        notes,
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitCost: Math.round(Number(line.unitCost) * 100) / 100 })),
      });
      if (!result.ok) { setError(result.message); return; }
      router.push("/lotes/" + result.id);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Panel title="Saldo que ainda está sem lote" description="A associação mantém o estoque geral igual e exige custo unitário conhecido." >
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há saldo elegível sem lote para associar.</p>
        ) : (
          <div className="grid gap-4">
            {lines.map((line, index) => (
              <div key={line.key} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1.4fr_.6fr_.8fr_auto] md:items-end">
                <Field label="Produto e sabor">
                  <Select value={line.variantId} onChange={(event) => update(index, { variantId: event.target.value })} required>
                    {options.map((option) => (
                      <option key={option.variant_id} value={option.variant_id}>
                        {option.product_name} · {getFlavorDisplayName({ name: option.variant_name, is_ice: option.variant_is_ice })} · {option.unassigned} sem lote
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Quantidade">
                  <Input type="number" min={1} step={1} max={options.find((option) => option.variant_id === line.variantId)?.unassigned ?? 0}
                    value={line.quantity} onChange={(event) => update(index, { quantity: Number(event.target.value) })} required />
                </Field>
                <Field label="Custo histórico conhecido (R$)">
                  <Input type="number" min={0} step="0.01" value={line.unitCost}
                    onChange={(event) => update(index, { unitCost: event.target.value })} required />
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover item" disabled={lines.length === 1}
                  onClick={() => { setLines((current) => current.filter((_, i) => i !== index)); setReview(false); }}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => {
              const option = options[0];
              if (!option) return;
              setLines((current) => [...current, { key: crypto.randomUUID(), variantId: option.variant_id, quantity: 1, unitCost: "" }]);
              setReview(false);
            }}><Plus /> Adicionar sabor</Button>
            <Field label="Observação opcional">
              <Input value={notes} onChange={(event) => { setNotes(event.target.value); setReview(false); }} placeholder="Estoque legado associado" />
            </Field>
          </div>
        )}
      </Panel>
      {options.length > 0 ? (
        <Panel title={review ? "Confirmar associação?" : "Resumo da associação"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-lg border border-border p-3">Unidades a associar <strong className="block text-xl">{totalQuantity}</strong></p>
            <p className="rounded-lg border border-primary/30 bg-primary/10 p-3">Custo histórico informado <strong className="block text-xl text-primary">{formatBRL(totalCost)}</strong></p>
          </div>
          {review ? <ul className="mt-3 grid gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
            {lines.map((line) => {
              const option = options.find((item) => item.variant_id === line.variantId);
              return <li key={line.key} className="flex flex-wrap justify-between gap-2">
                <span>{option?.product_name} · {option ? getFlavorDisplayName({ name: option.variant_name, is_ice: option.variant_is_ice }) : "Variação"} · {line.quantity} × {formatBRL(line.unitCost)}</span>
                <strong>{formatBRL(Number(line.unitCost) * line.quantity)}</strong>
              </li>;
            })}
          </ul> : null}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Esta ação só reclassifica o saldo sem origem para um lote marcado como ESTOQUE LEGADO. Ela não representa uma nova compra nem aumenta o estoque total.
          </p>
          {review ? <div className="mt-4 grid gap-3">
            <Notice tone="info">Confirme apenas os saldos e custos que você conhece. Valores históricos não serão estimados.</Notice>
            <Button type="submit" size="lg" disabled={pending}>{pending ? "Associando estoque..." : "Confirmar lote legado"}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setReview(false)}>Voltar e editar</Button>
          </div> : <Button type="submit" size="lg" className="mt-4" disabled={!lines.length}>Revisar associação</Button>}
          {error ? <div className="mt-3"><Notice>{error}</Notice></div> : null}
        </Panel>
      ) : null}
    </form>
  );
}
