"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/lib/actions/sales";
import { previewSale, type SalePreview } from "@/lib/domain/finance";
import { formatBRL, todayInBrazil } from "@/lib/format";
import type { CatalogSnapshot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";

export function SaleForm({
  catalog,
  canWrite,
}: {
  catalog: CatalogSnapshot;
  canWrite: boolean;
}) {
  const products = catalog.products.filter((product) => product.active);
  const types = catalog.customerTypes.filter((type) => type.active);
  const statuses = catalog.statuses.filter((status) => status.active && !status.is_terminal);
  const customers = catalog.customers.filter((customer) => customer.active);

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const variants = catalog.variants.filter(
    (variant) => variant.product_id === productId && variant.active,
  );
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [typeId, setTypeId] = useState(types.find((type) => type.code === "normal")?.id ?? types[0]?.id ?? "");
  const [statusId, setStatusId] = useState(
    statuses.find((status) => status.code === "recebido")?.id ?? statuses[0]?.id ?? "",
  );
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [fiado, setFiado] = useState(false);
  const [date, setDate] = useState(todayInBrazil());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const status = statuses.find((item) => item.id === statusId);
  const received = Boolean(status?.counts_as_received);
  const price = catalog.prices.find(
    (rule) => rule.product_id === productId && rule.customer_type_id === typeId,
  );
  const available = catalog.stock.find((item) => item.variant_id === variantId)?.quantity ?? 0;

  const preview = useMemo(() => {
    if (!price || quantity <= 0) return null;
    try {
      return previewSale({
        unitPrice: Number(price.sale_price),
        unitTransfer: Number(price.father_transfer),
        quantity,
        received,
        isCredit: !received && fiado,
      });
    } catch {
      return null;
    }
  }, [price, quantity, received, fiado]);

  function changeProduct(nextId: string) {
    setProductId(nextId);
    const nextVariant = catalog.variants.find(
      (variant) => variant.product_id === nextId && variant.active,
    );
    setVariantId(nextVariant?.id ?? "");
  }

  function changeCustomer(nextId: string) {
    setCustomerId(nextId);
    const customer = customers.find((item) => item.id === nextId);
    if (!customer) return;
    setCustomerName(customer.name);
    if (customer.customer_type_id) setTypeId(customer.customer_type_id);
  }

  function changeStatus(nextId: string) {
    setStatusId(nextId);
    const next = statuses.find((item) => item.id === nextId);
    if (next?.counts_as_received) setFiado(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSaleAction({
        saleDate: date,
        customerId,
        customerName,
        customerTypeId: typeId,
        paymentStatusId: statusId,
        isCredit: !received && fiado,
        notes,
        variantId,
        quantity,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/vendas/${result.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {!canWrite ? (
        <Notice tone="info">Seu perfil só permite consulta. A venda não será gravada.</Notice>
      ) : null}
      <div className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-2">
        <Field label="Data">
          <Input className="h-12 rounded-xl text-base" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label="Cliente cadastrado" hint="Opcional. Você pode vender só com o nome.">
          <Select value={customerId} onChange={(event) => changeCustomer(event.target.value)}>
            <option value="">Sem cadastro</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome na venda" className="md:col-span-2">
          <Input
            className="h-12 rounded-xl text-base"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Quem está comprando"
            required
          />
        </Field>
        <Field label="Produto">
          <Select value={productId} onChange={(event) => changeProduct(event.target.value)} required>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sabor" hint={variantId ? `Estoque atual: ${available}` : undefined}>
          <Select value={variantId} onChange={(event) => setVariantId(event.target.value)} required>
            {variants.map((variant) => {
              const qty = catalog.stock.find((item) => item.variant_id === variant.id)?.quantity ?? 0;
              return (
                <option key={variant.id} value={variant.id}>
                  {variant.name} · {qty} un
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="Tipo de cliente">
          <Select value={typeId} onChange={(event) => setTypeId(event.target.value)} required>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantidade">
          <Input
            className="h-12 rounded-xl text-base"
            inputMode="numeric"
            min={1}
            step={1}
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            required
          />
        </Field>
        <Field label="Pagamento">
          <Select value={statusId} onChange={(event) => changeStatus(event.target.value)} required>
            {statuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Fiado"
          hint="Marque se o repasse ao pai será assumido agora, antes de o cliente pagar."
        >
          <label className="flex min-h-12 items-center gap-3 rounded-xl border px-3">
            <Checkbox
              checked={!received && fiado}
              disabled={received}
              onCheckedChange={(checked) => setFiado(checked === true)}
              className="h-5 w-5"
            />
            <span className="text-sm">{received ? "Não se aplica a venda recebida" : "Sim, é fiado"}</span>
          </label>
        </Field>
        <Field label="Observações" className="md:col-span-2">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>

      <Summary preview={preview} missingPrice={!price} available={available} quantity={quantity} />
      {quantity > available ? (
        <Notice>Estoque insuficiente. Disponível: {available}.</Notice>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}

      <Button
        type="submit"
        className="h-12 rounded-xl text-base"
        disabled={!canWrite || pending || !preview || quantity > available || quantity < 1}
      >
        {pending ? "Registrando..." : "Confirmar venda"}
      </Button>
    </form>
  );
}

function Summary({
  preview,
  missingPrice,
  available,
  quantity,
}: {
  preview: SalePreview | null;
  missingPrice: boolean;
  available: number;
  quantity: number;
}) {
  if (missingPrice) {
    return <Notice tone="info">Não há preço configurado para este produto e tipo de cliente.</Notice>;
  }
  if (!preview) return null;
  const rows = [
    ["Preço unitário", formatBRL(preview.unitPrice)],
    ["Repasse unitário ao pai", formatBRL(preview.unitTransfer)],
    ["Lucro unitário", formatBRL(preview.unitProfit)],
    ["Total da venda", formatBRL(preview.total)],
    ["Parte do pai", formatBRL(preview.transfer)],
    ["Lucro", formatBRL(preview.profit)],
  ];
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-display text-xl">Resumo</h2>
      <dl className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm">
        Pagamento: {preview.received ? "Recebido" : "A receber"}
        {preview.isCredit ? " · Fiado" : ""}. Repasse: {preview.transferLabel}.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Estoque depois da venda: {available - quantity}.
      </p>
    </section>
  );
}
