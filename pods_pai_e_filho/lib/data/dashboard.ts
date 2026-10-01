import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/errors";
import type { Metrics, Product, SaleOverview, StockBalance, StockDivergence } from "@/lib/types";

const emptyMetrics = (): Metrics => ({
  money_received: "0",
  receivable: "0",
  profit_received: "0",
  profit_total: "0",
  transfer_from_received: "0",
  transfer_future: "0",
  transfer_due_now: "0",
  transfer_total: "0",
  sales_count: 0,
  units_sold: 0,
});

export async function loadDashboard(from: string | null, to: string | null) {
  const supabase = await createClient();
  const metricsQuery = supabase.rpc("dashboard_metrics", {
    p_from: from,
    p_to: to,
  });

  let recent = supabase
    .from("sales_overview")
    .select("*")
    .eq("is_valid", true)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);
  if (from) recent = recent.gte("sale_date", from);
  if (to) recent = recent.lte("sale_date", to);

  const [metrics, sales, stock, products, divergences, threshold] = await Promise.all([
    metricsQuery,
    recent,
    supabase.from("stock_balances").select("*").order("product_name"),
    supabase.from("products").select("id, name, active").order("name"),
    supabase.from("stock_divergences").select("*"),
    supabase.from("app_settings").select("value").eq("key", "low_stock_threshold").maybeSingle(),
  ]);

  const error = metrics.error || sales.error || stock.error || products.error;
  if (error) {
    return {
      ok: false as const,
      message: isMissingSchema(error)
        ? "Execute a migration SQL no Supabase antes de usar o sistema."
        : error.message,
    };
  }

  const row = (metrics.data?.[0] ?? emptyMetrics()) as Metrics;
  const thresholdValue = Number(threshold.data?.value ?? 5);

  return {
    ok: true as const,
    metrics: {
      ...emptyMetrics(),
      ...row,
      sales_count: Number(row.sales_count ?? 0),
      units_sold: Number(row.units_sold ?? 0),
    },
    sales: (sales.data ?? []) as SaleOverview[],
    stock: (stock.data ?? []) as StockBalance[],
    products: (products.data ?? []) as Pick<Product, "id" | "name" | "active">[],
    divergences: ((divergences.data ?? []) as StockDivergence[]).filter(
      (item) => item.difference !== 0,
    ),
    lowStockThreshold: Number.isFinite(thresholdValue) ? thresholdValue : 5,
  };
}
