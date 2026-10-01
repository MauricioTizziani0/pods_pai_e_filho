"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSaleAction, confirmReceiptAction, updateSaleAction } from "@/lib/actions/sales";
import { formatBRL, formatDateTime } from "@/lib/format";
import type { AuditLog, CatalogSnapshot, SaleOverview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { CreditBadge, PaymentBadge, TransferBadge } from "@/components/sales/badges";

const auditLabels: Record<string, string> = {
  "sale.created": "Venda registrada",
  "sale.updated": "Venda alterada",
  "sale.cancelled": "Venda cancelada",
  "sale.payment_confirmed": "Recebimento confirmado",
  "transfer.confirmed": "Repasse confirmado",
};

export function SaleEditor({
  sale,
  catalog,
  audit,
  canWrite,
}: {
  sale: SaleOverview;
  catalog: CatalogSnapshot;
  audit: AuditLog[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(sale.sale_date);
  const [customerId, setCustomerId] = useState(sale.customer_id ?? "");
  const [customerName, setCustomerName] = useState(sale.customer_name);
  const [typeId, setTypeId] = useState(sale.customer_type_id);
  const [statusId, setStatusId] = useState(sale.payment_status_id);
  const [variantId, setVariantId] = useState(sale.variant_id ?? "");
  const [quantity, setQuantity] = useState(sale.quantity);
  const [fiado, setFiado] = useState(sale.is_credit);
  const [notes, setNotes] = useState(sale.notes ?? "");

  const products = catalog.products.filter((product) => product.active);
  const selectedVariant = catalog.variants.find((variant) => variant.id === variantId);
  const productId = selectedVariant?.product_id ?? sale.product_id ?? products[0]?.id ?? "";
  const variants = catalog.variants.filter(
    (variant) => variant.product_id === productId && (variant.active || variant.id === sale.variant_id),
  );
  const statuses = catalog.statuses.filter(
    (status) => status.active && !status.is_terminal,
  );
  const status = statuses.find((item) => item.id === statusId);
  const received = Boolean(status?.counts_as_received);
  const locked = sale.transfer_paid;

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Não foi possível salvar.");
        return;
      }
      setMessage("Alteração salva.");
      setConfirmCancel(false);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <PaymentBadge
            name={sale.payment_status_name}
            received={sale.counts_as_received}
            cancelled={!sale.is_valid}
          />
          {sale.is_credit ? <CreditBadge /> : null}
          <TransferBadge
            paid={sale.transfer_paid}
            dueNow={sale.transfer_due_now}
            future={sale.transfer_is_future}
            cancelled={!sale.is_valid}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Money label="Total" value={sale.total_amount} />
          <Money label="Parte do pai" value={sale.transfer_amount} />
          <Money label="Lucro" value={sale.profit_amount} />
          <Money label="Unitário" value={sale.unit_price} />
        </dl>
        {sale.cancel_reason ? (
          <p className="mt-3 text-sm text-muted-foreground">Motivo do cancelamento: {sale.cancel_reason}</p>
        ) : null}
      </section>

      {canWrite && sale.is_valid ? (
        <form
          className="grid gap-4 rounded-2xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(() =>
              updateSaleAction({
                saleId: sale.id,
                saleDate: date,
                customerId,
                customerName,
                customerTypeId: typeId,
                paymentStatusId: statusId,
                isCredit: received ? sale.is_credit : fiado,
                notes,
                variantId,
                quantity,
              }),
            );
          }}
        >
          <h2 className="font-display text-xl">Editar</h2>
          {locked ? (
            <Notice tone="info">
              O repasse já foi pago. Produto, quantidade, tipo e fiado ficam preservados.
            </Notice>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Data">
              <Input className="h-12 rounded-xl text-base" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Cliente cadastrado">
              <Select
                value={customerId}
                onChange={(event) => {
                  const next = event.target.value;
                  setCustomerId(next);
                  const customer = catalog.customers.find((item) => item.id === next);
                  if (customer) setCustomerName(customer.name);
                }}
              >
                <option value="">Sem cadastro</option>
                {catalog.customers.filter((customer) => customer.active).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome" className="md:col-span-2">
              <Input className="h-12 rounded-xl text-base" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
            </Field>
            <Field label="Produto">
              <Select
                disabled={locked}
                value={productId}
                onChange={(event) => {
                  const next = catalog.variants.find(
                    (variant) => variant.product_id === event.target.value && variant.active,
                  );
                  setVariantId(next?.id ?? "");
                }}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sabor">
              <Select disabled={locked} value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select disabled={locked} value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                {catalog.customerTypes.filter((type) => type.active).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantidade">
              <Input
                className="h-12 rounded-xl text-base"
                disabled={locked}
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </Field>
            <Field label="Pagamento">
              <Select value={statusId} onChange={(event) => setStatusId(event.target.value)}>
                {statuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fiado" hint="Só altera o repasse enquanto a venda está a receber.">
              <label className="flex min-h-12 items-center gap-3 rounded-xl border px-3">
                <Checkbox
                  checked={received ? sale.is_credit : fiado}
                  disabled={locked || received}
                  onCheckedChange={(checked) => setFiado(checked === true)}
                  className="h-5 w-5"
                />
                <span className="text-sm">{received && sale.is_credit ? "Histórico de fiado mantido" : "Fiado"}</span>
              </label>
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="h-12 rounded-xl" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      ) : null}

      {canWrite && sale.is_valid && !sale.counts_as_received ? (
        <Button
          type="button"
          className="h-12 rounded-xl"
          disabled={pending}
          onClick={() => run(() => confirmReceiptAction(sale.id))}
        >
          Confirmar recebimento
        </Button>
      ) : null}

      {canWrite && sale.is_valid ? (
        <section className="rounded-2xl border border-red-200 bg-card p-4">
          {!confirmCancel ? (
            <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => setConfirmCancel(true)}>
              Cancelar venda
            </Button>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm">
                O estoque volta e os valores saem dos indicadores. A venda permanece no histórico.
              </p>
              <TextArea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo" />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="h-12 rounded-xl"
                  disabled={pending}
                  onClick={() => run(() => cancelSaleAction(sale.id, reason))}
                >
                  Confirmar cancelamento
                </Button>
                <Button type="button" variant="ghost" className="h-12" onClick={() => setConfirmCancel(false)}>
                  Voltar
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}

      <section className="grid gap-2">
        <h2 className="font-display text-xl">Histórico</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          audit.map((entry) => (
            <article key={entry.id} className="rounded-xl border bg-card px-3 py-2 text-sm">
              <p className="font-medium">{auditLabels[entry.action] ?? entry.action}</p>
              <p className="text-muted-foreground">
                {formatDateTime(entry.created_at)}
                {entry.user_name ? ` · ${entry.user_name}` : ""}
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function Money({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-base font-semibold">{formatBRL(value)}</dd>
    </div>
  );
}
