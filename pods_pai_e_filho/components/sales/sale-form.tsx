"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calculator, HandCoins, Send, ShoppingCart, User } from "lucide-react";
import { createSaleAction } from "@/lib/actions/sales";
import { previewSale, type SalePreview } from "@/lib/domain/finance";
import { formatBRL, todayInBrazil } from "@/lib/format";
import { getFlavorDisplayName } from "@/lib/domain/flavors";
import type { CatalogSnapshot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const isCredit = !received && fiado;

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
    <form onSubmit={submit} className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="grid gap-5">
        {!canWrite ? (
          <Notice tone="info">Seu perfil só permite consulta. A venda não será gravada.</Notice>
        ) : null}

        <Panel title="Cliente" icon={User}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Data">
              <Input className="h-12" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
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
                className="h-12"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Quem está comprando"
                required
              />
            </Field>
            <Field label="Tipo de cliente" className="md:col-span-2">
              <Select value={typeId} onChange={(event) => setTypeId(event.target.value)} required>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <Panel title="Produto" icon={ShoppingCart}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Produto">
              <Select value={productId} onChange={(event) => changeProduct(event.target.value)} required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sabor">
              <Select value={variantId} onChange={(event) => setVariantId(event.target.value)} required>
                {variants.map((variant) => {
                  const qty = catalog.stock.find((item) => item.variant_id === variant.id)?.quantity ?? 0;
                  return (
                    <option key={variant.id} value={variant.id}>
                      {getFlavorDisplayName(variant)} · {qty} un
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label="Quantidade">
              <Input
                className="h-12 font-display text-lg font-semibold"
                inputMode="numeric"
                min={1}
                step={1}
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                required
              />
            </Field>
            <div className="flex flex-col justify-end gap-1.5">
              <span className="eyebrow">Estoque atual</span>
              <div className="flex h-12 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3">
                <span className="min-w-0 font-display text-lg font-semibold tabular-nums">{available} un</span>
                {available <= 0 ? (
                  <Badge variant="danger">Sem estoque</Badge>
                ) : quantity > available ? (
                  <Badge variant="warning">Insuficiente</Badge>
                ) : (
                  <Badge variant="success">Disponível</Badge>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Pagamento" icon={HandCoins}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Situação do pagamento">
              <Select value={statusId} onChange={(event) => changeStatus(event.target.value)} required>
                {statuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Venda fiada"
              hint="Marque se o repasse ao pai será assumido agora, antes de o cliente pagar."
            >
              <label
                className={cn(
                  "flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-lg border bg-surface px-3 transition-[border-color,box-shadow,background-color]",
                  isCredit
                    ? "border-primary/60 bg-primary/10 shadow-glow-sm"
                    : "border-input hover:border-primary/40",
                  received && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  checked={isCredit}
                  disabled={received}
                  onCheckedChange={(checked) => setFiado(checked === true)}
                />
                <span className="min-w-0 text-sm font-medium">
                  {received ? "Não se aplica a venda recebida" : "Sim, é fiado"}
                </span>
                {isCredit ? <Badge variant="danger" className="ml-auto">Fiado</Badge> : null}
              </label>
            </Field>
            {isCredit ? (
              <div className="animate-enter flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-3 text-sm md:col-span-2">
                <Send className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="leading-relaxed">
                  O valor correspondente ao repasse do pai
                  {preview ? <strong className="text-primary"> ({formatBRL(preview.transfer)})</strong> : null} será
                  considerado em <strong>“A enviar ao pai agora”</strong>, mesmo antes do recebimento do cliente.
                </p>
              </div>
            ) : null}
            <Field label="Observações" className="md:col-span-2">
              <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:sticky lg:top-6">
        <Summary preview={preview} missingPrice={!price} available={available} quantity={quantity} />
        {quantity > available ? (
          <Notice>Estoque insuficiente. Disponível: {available}.</Notice>
        ) : null}
        {error ? <Notice>{error}</Notice> : null}

        <Button
          type="submit"
          size="lg"
          className="h-12"
          disabled={!canWrite || pending || !preview || quantity > available || quantity < 1}
        >
          {pending ? "Registrando..." : "Confirmar venda"}
        </Button>
      </div>
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
  const rows: Array<[string, string, string?]> = [
    ["Preço unitário", formatBRL(preview.unitPrice)],
    ["Repasse unitário ao pai", formatBRL(preview.unitTransfer)],
    ["Lucro unitário", formatBRL(preview.unitProfit), "text-success"],
  ];
  return (
    <Panel title="Resumo" icon={Calculator} glow bodyClassName="p-0">
      <div className="px-4 pt-4">
        <p className="eyebrow">Total da venda</p>
        <p className="mt-1 break-words font-display text-2xl font-bold tabular-nums glow-text sm:text-3xl">{formatBRL(preview.total)}</p>
      </div>
      <dl className="mt-4 grid gap-2 border-t border-border/70 px-4 py-3 text-sm">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex min-w-0 items-center justify-between gap-3">
            <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
            <dd className={cn("shrink-0 text-right font-medium tabular-nums", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-2 border-t border-border/70 px-4 py-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
          <p className="eyebrow text-[10px]">Parte do pai</p>
          <p className="mt-1 break-words font-display text-lg font-bold tabular-nums text-primary">{formatBRL(preview.transfer)}</p>
        </div>
        <div className="min-w-0 rounded-md border border-success/30 bg-success/10 px-3 py-2">
          <p className="eyebrow text-[10px]">Lucro</p>
          <p className="mt-1 break-words font-display text-lg font-bold tabular-nums text-success">{formatBRL(preview.profit)}</p>
        </div>
      </div>
      <div className="grid gap-1.5 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
        <p>
          Pagamento:{" "}
          <span className="text-foreground">{preview.received ? "Recebido" : "A receber"}</span>
          {preview.isCredit ? <span className="text-primary"> · Fiado</span> : ""}. Repasse:{" "}
          <span className="text-foreground">{preview.transferLabel}</span>.
        </p>
        <p>
          Estoque depois da venda: <span className="text-foreground tabular-nums">{available - quantity}</span>.
        </p>
      </div>
    </Panel>
  );
}
