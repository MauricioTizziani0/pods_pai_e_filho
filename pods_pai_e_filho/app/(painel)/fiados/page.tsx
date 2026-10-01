import { listSales } from "@/lib/data/sales";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { SaleList } from "@/components/sales/sale-list";

export const metadata = { title: "Fiados" };

export default async function FiadosPage() {
  const sales = await listSales({ openCredit: true });
  return (
    <div>
      <PageHeading
        title="Fiados"
        description="Vendas a receber em que a parte do pai já entrou em “A enviar agora”."
      />
      {!sales.ok ? <Notice>{sales.message}</Notice> : <SaleList sales={sales.sales} />}
    </div>
  );
}
