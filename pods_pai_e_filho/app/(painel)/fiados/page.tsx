import { Bookmark, Clock, Send } from "lucide-react";
import { listSales } from "@/lib/data/sales";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { SaleList } from "@/components/sales/sale-list";
import { StatCard } from "@/components/ui/stat-card";
import { getSessionState } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isConsultasRole } from "@/lib/domain/roles";

export const metadata = { title: "Fiados" };

export default async function FiadosPage() {
  const session = await getSessionState();
  if (session.status === "ok" && (isConsultasRole(session.profile.role_code) || !session.profile.can_write)) redirect("/repasses");
  const sales = await listSales({ openCredit: true });
  const totals = sales.ok
    ? sales.sales.reduce(
        (acc, sale) => ({
          receivable: acc.receivable + Number(sale.total_amount),
          transfer: acc.transfer + (sale.transfer_due_now ? Number(sale.transfer_amount) : 0),
        }),
        { receivable: 0, transfer: 0 },
      )
    : { receivable: 0, transfer: 0 };

  return (
    <div className="grid w-full min-w-0 gap-5">
      <PageHeading
        title="Fiados"
        eyebrow="Financeiro"
        description="Vendas a receber em que a parte do pai já entrou em “A enviar agora”."
      />
      {sales.ok ? (
        <section className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Fiados em aberto" value={sales.sales.length} kind="int" icon={Bookmark} tone="warning" />
          <StatCard label="A receber dos clientes" value={totals.receivable} icon={Clock} tone="warning" />
          <StatCard
            label="Repasse pendente ao pai"
            value={totals.transfer}
            icon={Send}
            tone="primary"
            hint="Parte destes fiados ainda em “A enviar ao pai agora”"
            className="sm:col-span-2 lg:col-span-1"
          />
        </section>
      ) : null}
      {!sales.ok ? <Notice>{sales.message}</Notice> : <SaleList sales={sales.sales} />}
    </div>
  );
}
