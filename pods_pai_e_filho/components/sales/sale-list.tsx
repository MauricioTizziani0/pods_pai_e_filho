import Link from "next/link";
import { formatBRL, formatDate } from "@/lib/format";
import type { SaleOverview } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditBadge, PaymentBadge, TransferBadge } from "@/components/sales/badges";

export function SaleList({ sales }: { sales: SaleOverview[] }) {
  if (sales.length === 0) {
    return (
      <EmptyState
        title="Nenhuma venda encontrada"
        description="Ajuste os filtros ou registre a primeira venda."
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Qtd</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t">
                <td className="px-4 py-3">{formatDate(sale.sale_date)}</td>
                <td className="px-4 py-3">
                  <Link href={`/vendas/${sale.id}`} className="font-medium hover:underline">
                    {sale.customer_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{sale.customer_type_name}</p>
                </td>
                <td className="px-4 py-3">
                  {sale.product_name} · {sale.variant_name}
                </td>
                <td className="px-4 py-3 tabular-nums">{sale.quantity}</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(sale.total_amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {sales.map((sale) => (
          <Link
            key={sale.id}
            href={`/vendas/${sale.id}`}
            className="rounded-2xl border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{sale.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(sale.sale_date)} · {sale.product_name} · {sale.variant_name}
                </p>
              </div>
              <p className="tabular-nums font-semibold">{formatBRL(sale.total_amount)}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
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
            <p className="mt-3 text-sm text-muted-foreground">
              {sale.quantity} un · lucro {formatBRL(sale.profit_amount)} · repasse{" "}
              {formatBRL(sale.transfer_amount)}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
