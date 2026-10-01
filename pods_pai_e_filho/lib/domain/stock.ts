import type { Product, StockBalance } from "@/lib/types";

export type ProductStockSummary = {
  product_id: string;
  product_name: string;
  quantity: number;
};

/** Sums movement-derived balances for active variants under each active product. */
export function summarizeActiveProductStock(
  products: Pick<Product, "id" | "name" | "active">[],
  balances: Pick<StockBalance, "product_id" | "product_name" | "product_active" | "variant_active" | "quantity">[],
): ProductStockSummary[] {
  const totals = new Map<string, ProductStockSummary>();

  for (const product of products) {
    if (product.active) {
      totals.set(product.id, {
        product_id: product.id,
        product_name: product.name,
        quantity: 0,
      });
    }
  }

  for (const balance of balances) {
    const product = totals.get(balance.product_id);
    if (product && balance.product_active && balance.variant_active) {
      product.quantity += balance.quantity;
    }
  }

  return [...totals.values()];
}

export function getLowStockProducts(
  products: ProductStockSummary[],
  threshold: number,
) {
  return products.filter((product) => product.quantity <= threshold);
}
