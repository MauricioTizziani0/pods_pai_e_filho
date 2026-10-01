import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/errors";
import type {
  CatalogSnapshot,
  Customer,
  CustomerType,
  PaymentStatus,
  PriceRule,
  Product,
  ProductVariant,
  StockBalance,
} from "@/lib/types";

export async function loadCatalog(): Promise<
  { ok: true; data: CatalogSnapshot } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const [products, variants, customerTypes, statuses, prices, customers, stock, saleItems, movements, countLines] =
    await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("product_variants").select("*").order("name"),
      supabase.from("customer_types").select("*").order("sort_order"),
      supabase.from("payment_statuses").select("*").order("sort_order"),
      supabase.from("price_rules").select("*").eq("active", true),
      supabase.from("customers").select("*").order("name"),
      supabase.from("stock_balances").select("*").order("product_name"),
      supabase.from("sale_items").select("product_id, variant_id"),
      supabase.from("stock_movements").select("product_id, variant_id"),
      supabase.from("stock_count_lines").select("product_id, variant_id"),
    ]);

  const firstError =
    products.error ||
    variants.error ||
    customerTypes.error ||
    statuses.error ||
    prices.error ||
    customers.error ||
    stock.error ||
    saleItems.error ||
    movements.error ||
    countLines.error;

  if (firstError) {
    return {
      ok: false,
      message: isMissingSchema(firstError)
        ? "Execute a migration SQL no Supabase antes de usar o sistema."
        : firstError.message,
    };
  }

  return {
    ok: true,
    data: {
      products: ((products.data ?? []) as Product[]).map((product) => ({
        ...product,
        has_history:
          (saleItems.data ?? []).some((row) => row.product_id === product.id) ||
          (movements.data ?? []).some((row) => row.product_id === product.id) ||
          (countLines.data ?? []).some((row) => row.product_id === product.id),
      })),
      variants: ((variants.data ?? []) as ProductVariant[]).map((variant) => ({
        ...variant,
        is_ice: Boolean(variant.is_ice),
        has_history:
          (saleItems.data ?? []).some((row) => row.variant_id === variant.id) ||
          (movements.data ?? []).some((row) => row.variant_id === variant.id) ||
          (countLines.data ?? []).some((row) => row.variant_id === variant.id),
      })),
      customerTypes: (customerTypes.data ?? []) as CustomerType[],
      statuses: (statuses.data ?? []) as PaymentStatus[],
      prices: (prices.data ?? []) as PriceRule[],
      customers: (customers.data ?? []) as Customer[],
      stock: ((stock.data ?? []) as StockBalance[]).map((item) => ({
        ...item,
        variant_is_ice: Boolean(item.variant_is_ice),
      })),
    },
  };
}

export async function loadLowStockThreshold() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "low_stock_threshold")
    .maybeSingle();
  if (error || data?.value == null) return 5;
  const value = Number(data.value);
  return Number.isFinite(value) ? value : 5;
}
