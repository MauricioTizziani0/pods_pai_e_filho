"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createPurchaseAction } from "@/lib/actions/stock";
import { formatBRL, todayInBrazil } from "@/lib/format";
import { getFlavorDisplayName } from "@/lib/domain/flavors";
import type { CatalogSnapshot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Panel } from "@/components/ui/panel";

type Line = { key: string; productId: string; variantId: string; quantity: number; unitCost: string };

export function PurchaseForm({ catalog }: { catalog: CatalogSnapshot }) {
  const router = useRouter();
  const products = catalog.products.filter((product) => product.active);
  const first = products[0];
  const firstVariant = catalog.variants.find((variant) => variant.active && variant.product_id === first?.id);
  const [date, setDate] = useState(todayInBrazil());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{
    key: "first", productId: first?.id ?? "", variantId: firstVariant?.id ?? "",
    quantity: 1, unitCost: first?.cost_price ?? "",
  }]);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const cost = lines.reduce((sum, line) => sum + (Number(line.unitCost) || 0) * line.quantity, 0);

  function update(index: number, values: Partial<Line>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...values } : line));
    setReview(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!review) {
      if (lines.some((line) => !line.variantId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.unitCost === "" || !Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0)) {
        setError("Preencha quantidade e custo unitário para cada item.");
        return;
      }
      setReview(true);
      return;
    }
    startTransition(async () => {
      const result = await createPurchaseAction({
        purchaseDate: date, notes,
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitCost: Math.round(Number(line.unitCost) * 100) / 100 })),
      });
      if (!result.ok) { setError(result.message); return; }
      router.push("/lotes/" + result.id);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <Panel title="Dados da compra" description="Cada compra confirmada cria um lote novo.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Data da compra"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setReview(false); }} required /></Field>
          <Field label="Observação (opcional)"><Input value={notes} onChange={(e) => { setNotes(e.target.value); setReview(false); }} /></Field>
        </div>
      </Panel>
      <Panel title="Itens" description="O custo informado fica preservado no histórico do lote.">
        <div className="grid gap-4">
          {lines.map((line, index) => {
            const variants = catalog.variants.filter((variant) => variant.active && variant.product_id === line.productId);
            return (
              <div key={line.key} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_.6fr_.8fr_auto]">
                <Field label="Produto">
                  <Select value={line.productId} onChange={(e) => {
                    const productId = e.target.value;
                    const product = products.find((item) => item.id === productId);
                    const variant = catalog.variants.find((item) => item.active && item.product_id === productId);
                    update(index, { productId, variantId: variant?.id ?? "", unitCost: product?.cost_price ?? "" });
                  }}>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </Select>
                </Field>
                <Field label="Sabor / variação">
                  <Select value={line.variantId} onChange={(e) => update(index, { variantId: e.target.value })} required>
                    {variants.map((variant) => <option key={variant.id} value={variant.id}>{getFlavorDisplayName(variant)}</option>)}
                  </Select>
                </Field>
                <Field label="Quantidade"><Input type="number" min={1} step={1} value={line.quantity} onChange={(e) => update(index, { quantity: Number(e.target.value) })} required /></Field>
                <Field label="Custo unitário (R$)"><Input type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => update(index, { unitCost: e.target.value })} required /></Field>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover item" disabled={lines.length === 1} onClick={() => { setLines((current) => current.filter((_, i) => i !== index)); setReview(false); }}><Trash2 /></Button>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={() => {
            const product = products[0];
            const variant = catalog.variants.find((item) => item.active && item.product_id === product?.id);
            setLines((current) => [...current, { key: crypto.randomUUID(), productId: product?.id ?? "", variantId: variant?.id ?? "", quantity: 1, unitCost: product?.cost_price ?? "" }]);
            setReview(false);
          }}><Plus /> Adicionar item</Button>
        </div>
      </Panel>
      <Panel title={review ? "Confirmar nova compra?" : "Resumo"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-lg border border-border p-3">Unidades <strong className="block text-xl">{units}</strong></p>
          <p className="rounded-lg border border-primary/30 bg-primary/10 p-3">Capital investido <strong className="block text-xl text-primary">{formatBRL(cost)}</strong></p>
        </div>
        {review ? <div className="mt-4 grid gap-3">
          <ul className="grid gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
            {lines.map((line) => {
              const product = products.find((item) => item.id === line.productId);
              const variant = catalog.variants.find((item) => item.id === line.variantId);
              return <li key={line.key} className="flex flex-wrap justify-between gap-2">
                <span>{product?.name} · {variant ? getFlavorDisplayName(variant) : "Variação"} · {line.quantity} × {formatBRL(line.unitCost)}</span>
                <strong>{formatBRL(Number(line.unitCost) * line.quantity)}</strong>
              </li>;
            })}
          </ul>
          <Notice tone="info">A confirmação cria um lote novo e registra todos os itens e entradas de estoque na mesma operação.</Notice>
          <Button type="submit" size="lg" disabled={pending}>{pending ? "Registrando compra..." : "Confirmar compra e criar lote"}</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setReview(false)}>Voltar e editar</Button>
        </div> : <Button type="submit" size="lg" className="mt-4">Revisar compra</Button>}
        {error ? <div className="mt-3"><Notice>{error}</Notice></div> : null}
      </Panel>
    </form>
  );
}
