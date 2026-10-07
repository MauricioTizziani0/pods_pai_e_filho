import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/errors";
import { CONSULTAS_SALE_OVERVIEW_COLUMNS } from "@/lib/data/sales";
import { loadFinancialSales } from "@/lib/data/financial-sales";
import { consultasSummaryForBatchSales, metricsForBatchSales } from "@/lib/domain/batch-sales";
import type { ConsultasFinancialSummary, Metrics, Product, SaleOverview, StockBalance, StockDivergence } from "@/lib/types";

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

export async function loadDashboard(
  from: string | null,
  to: string | null,
  { consultas = false, batchId }: { consultas?: boolean; batchId?: string | null } = {},
) {
  const supabase = await createClient();
  const metricsQuery = consultas || batchId
    ? Promise.resolve({ data: null, error: null })
    : supabase.rpc("dashboard_metrics", {
        p_from: from,
        p_to: to,
      });

  let recent = supabase
    .from("sales_overview")
    .select(consultas ? CONSULTAS_SALE_OVERVIEW_COLUMNS : "*")
    .eq("is_valid", true)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);
  if (from) recent = recent.gte("sale_date", from);
  if (to) recent = recent.lte("sale_date", to);

  const [metrics, sales, stock, products, divergences, threshold, financial] = await Promise.all([
    metricsQuery,
    batchId ? Promise.resolve({ data: [], error: null }) : recent,
    supabase.from("stock_balances").select("*").order("product_name"),
    supabase.from("products").select("id, name, active").order("name"),
    supabase.from("stock_divergences").select("*"),
    supabase.from("app_settings").select("value").eq("key", "low_stock_threshold").maybeSingle(),
    batchId ? loadFinancialSales({ batchId, from: from ?? undefined, to: to ?? undefined, consultas }) : Promise.resolve(null),
  ]);

  if (financial && !financial.ok) return { ok: false as const, message: financial.message };

  const dataError = sales.error || stock.error || products.error || ("error" in metrics ? metrics.error : null);
  if (dataError) {
    return {
      ok: false as const,
      message: isMissingSchema(dataError)
        ? "Execute a migration SQL no Supabase antes de usar o sistema."
        : dataError.message,
    };
  }

  const row = (financial && !consultas ? metricsForBatchSales(financial.lines) : metrics.data?.[0] ?? emptyMetrics()) as Metrics;
  const thresholdValue = Number(threshold.data?.value ?? 5);

  return {
    ok: true as const,
    metrics: {
      ...emptyMetrics(),
      ...row,
      sales_count: Number(row.sales_count ?? 0),
      units_sold: Number(row.units_sold ?? 0),
    },
    sales: financial ? financial.sales.slice(0, 6) : (sales.data ?? []) as unknown as SaleOverview[],
    stock: (stock.data ?? []) as StockBalance[],
    products: (products.data ?? []) as Pick<Product, "id" | "name" | "active">[],
    divergences: ((divergences.data ?? []) as StockDivergence[]).filter(
      (item) => item.difference !== 0,
    ),
    lowStockThreshold: Number.isFinite(thresholdValue) ? thresholdValue : 5,
  };
}

export async function loadConsultasFinancialSummary(
  from: string | null,
  to: string | null,
  filters: {
    productId?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    customerTypeId?: string | null;
    paymentStatusId?: string | null;
    ice?: boolean | null;
    flavor?: string | null;
    batchId?: string | null;
  } = {},
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultas_financial_summary", {
    p_from: from,
    p_to: to,
    p_product_id: filters.productId ?? null,
    p_customer_id: filters.customerId ?? null,
    p_customer_name: filters.customerName ?? null,
    p_customer_type_id: filters.customerTypeId ?? null,
    p_payment_status_id: filters.paymentStatusId ?? null,
    p_is_ice: filters.ice ?? null,
    p_flavor: filters.flavor ?? null,
  });

  if (error) return { ok: false as const, message: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as ConsultasFinancialSummary | null;
  if (!row) return { ok: false as const, message: "Não foi possível carregar o resumo financeiro." };
  if (filters.batchId) {
    const financial = await loadFinancialSales({
      batchId: filters.batchId, consultas: true,
      from: from ?? undefined, to: to ?? undefined,
      productId: filters.productId ?? undefined, customerId: filters.customerId ?? undefined,
      customer: filters.customerName ?? undefined, customerTypeId: filters.customerTypeId ?? undefined,
      paymentStatusId: filters.paymentStatusId ?? undefined,
      ice: filters.ice === true ? "sim" : filters.ice === false ? "nao" : undefined,
      flavor: filters.flavor ?? undefined,
    });
    if (!financial.ok) return { ok: false as const, message: financial.message };
    return { ok: true as const, summary: consultasSummaryForBatchSales(financial.lines, row) };
  }
  return { ok: true as const, summary: row };
}
