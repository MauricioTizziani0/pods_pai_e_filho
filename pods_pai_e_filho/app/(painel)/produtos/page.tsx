import { getSessionState } from "@/lib/auth";
import { loadCatalog } from "@/lib/data/catalog";
import { Notice } from "@/components/feedback/notice";
import { PageHeading } from "@/components/shell/page-heading";
import { ProductManager } from "@/components/catalog/product-manager";

export const metadata = { title: "Produtos" };

export default async function ProdutosPage() {
  const [catalog, session] = await Promise.all([loadCatalog(), getSessionState()]);
  const canWrite = session.status === "ok" && session.profile.can_write;
  const isAdmin = session.status === "ok" && session.profile.role_code.toLowerCase() === "admin";
  return (
    <div className="w-full min-w-0">
      <PageHeading
        title="Produtos"
        eyebrow="Catálogo e preços"
        description={canWrite ? "Cada sabor tem estoque próprio. O lucro da tabela é preço menos repasse ao pai." : "Consulte produtos, sabores disponíveis e estoque."}
      />
      {!catalog.ok ? <Notice>{catalog.message}</Notice> : <ProductManager catalog={catalog.data} canWrite={canWrite} isAdmin={isAdmin} />}
    </div>
  );
}
