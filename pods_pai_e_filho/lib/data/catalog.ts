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
  const [products, variants, customerTypes, statuses, prices, customers, stock] =
    await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("product_variants").select("*").order("name"),
      supabase.from("customer_types").select("*").order("sort_order"),
      supabase.from("payment_statuses").select("*").order("sort_order"),
      supabase.from("price_rules").select("*").eq("active", true),
      supabase.from("customers").select("*").order("name"),
      supabase.from("stock_balances").select("*").order("product_name"),
    ]);

  const firstError =
    products.error ||
    variants.error ||
    customerTypes.error ||
    statuses.error ||
    prices.error ||
    customers.error ||
    stock.error;

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
      products: (products.data ?? []) as Product[],
      variants: (variants.data ?? []) as ProductVariant[],
      customerTypes: (customerTypes.data ?? []) as CustomerType[],
      statuses: (statuses.data ?? []) as PaymentStatus[],
      prices: (prices.data ?? []) as PriceRule[],
      customers: (customers.data ?? []) as Customer[],
      stock: (stock.data ?? []) as StockBalance[],
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
