import { getSessionState } from "@/lib/auth";
import { loadCatalog, type ProductStatusFilter } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { ProductManager } from "@/components/catalog/product-manager";

export const metadata = { title: "Produtos" };

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusParam = Array.isArray(params.status) ? params.status[0] : params.status;
  const productStatus: ProductStatusFilter =
    statusParam === "all" || statusParam === "inactive" ? statusParam : "active";
  const [catalog, session] = await Promise.all([loadCatalog({ productStatus }), getSessionState()]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  const isAdmin = session.status === "ok" && session.profile.role_code.toLowerCase() === "admin";
  return (
    <div className="w-full min-w-0">
      <PageHeading
        title="Produtos"
        eyebrow="Catálogo e preços"
        description={canWrite ? "Cada sabor tem estoque próprio. O lucro da tabela é preço menos repasse ao pai." : "Consulte produtos, sabores disponíveis e estoque."}
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : <ProductManager catalog={catalog.data} productStatus={productStatus} canWrite={canWrite} isAdmin={isAdmin} />}
    </div>
  );
}
