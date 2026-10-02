import { createClient } from "@/lib/supabase/server";
import { flavorSearchOrFilter, iceFilterToBool, parseIceParam } from "@/lib/domain/flavors";
import type { AuditLog, SaleItem, SaleOverview } from "@/lib/types";

export const CONSULTAS_SALE_OVERVIEW_COLUMNS = [
  "id", "sale_date", "customer_id", "customer_name", "customer_type_id", "customer_type_name",
  "payment_status_id", "notes", "total_amount", "transfer_amount", "profit_amount", "transfer_paid",
  "transfer_paid_at", "transfer_id", "cancelled_at", "cancelled_by", "cancel_reason", "created_by",
  "created_at", "payment_status_code", "payment_status_name", "counts_as_received", "counts_as_receivable",
  "is_terminal", "is_valid", "transfer_due_now", "transfer_is_future", "quantity", "items_label",
  "product_id", "product_name", "variant_id", "variant_name", "unit_price", "unit_transfer", "unit_profit",
  "variant_is_ice",
].join(",");

export type SaleQuery = {
  from?: string;
  to?: string;
  productId?: string;
  customerTypeId?: string;
  paymentStatusId?: string;
  credit?: string;
  ice?: string;
  flavor?: string;
  customer?: string;
  situation?: string;
  dueNow?: boolean;
  future?: boolean;
  paid?: boolean;
  openCredit?: boolean;
  consultas?: boolean;
  limit?: number;
};

type CostLine = { cost_price_unit: string | null; line_cost: string | null; line_father_profit: string | null };

function withCostFigures(sale: SaleOverview, items: CostLine[]): SaleOverview {
  const missing = items.length === 0 || items.some((item) => item.cost_price_unit == null);
  return {
    ...sale,
    cost_history_missing: missing,
    cost_amount: missing ? null : String(items.reduce((sum, item) => sum + Number(item.line_cost), 0)),
    father_profit_amount: missing ? null : String(items.reduce((sum, item) => sum + Number(item.line_father_profit), 0)),
  };
}

export async function listSales(query: SaleQuery = {}) {
  const supabase = await createClient();
  let request = supabase
    .from("sales_overview")
    .select(query.consultas ? CONSULTAS_SALE_OVERVIEW_COLUMNS : "*")
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 200);

  if (query.from) request = request.gte("sale_date", query.from);
  if (query.to) request = request.lte("sale_date", query.to);
  if (query.productId) request = request.eq("product_id", query.productId);
  if (query.customerTypeId) request = request.eq("customer_type_id", query.customerTypeId);
  if (query.paymentStatusId) request = request.eq("payment_status_id", query.paymentStatusId);
  if (!query.consultas && query.credit === "sim") request = request.eq("is_credit", true);
  if (!query.consultas && query.credit === "nao") request = request.eq("is_credit", false);
  const ice = iceFilterToBool(parseIceParam(query.ice));
  if (ice === true) request = request.eq("variant_is_ice", true);
  if (ice === false) request = request.eq("variant_is_ice", false);
  const flavorOr = query.flavor ? flavorSearchOrFilter(query.flavor) : null;
  if (flavorOr) request = request.or(flavorOr);
  if (query.customer) request = request.ilike("customer_name", `%${query.customer}%`);
  if (query.situation !== "todas" && query.situation !== "canceladas") {
    request = request.eq("is_valid", true);
  }
  if (query.situation === "canceladas") request = request.eq("is_valid", false);
  if (query.dueNow) request = request.eq("transfer_due_now", true);
  if (query.future) request = request.eq("transfer_is_future", true);
  if (query.paid) request = request.eq("transfer_paid", true).eq("is_valid", true);
  if (!query.consultas && query.openCredit) {
    request = request
      .eq("is_credit", true)
      .eq("counts_as_receivable", true)
      .eq("is_valid", true);
  }

  const { data, error } = await request;
  if (error) return { ok: false as const, message: error.message, sales: [] as SaleOverview[] };
  const sales = (data ?? []) as unknown as SaleOverview[];
  if (sales.length === 0) return { ok: true as const, message: "", sales };

  const { data: itemRows, error: itemError } = await supabase
    .from("sale_items")
    .select("sale_id, cost_price_unit, line_cost, line_father_profit")
    .in("sale_id", sales.map((sale) => sale.id));
  if (itemError) return { ok: false as const, message: itemError.message, sales: [] as SaleOverview[] };

  const itemsBySale = new Map<string, CostLine[]>();
  for (const row of itemRows ?? []) {
    const group = itemsBySale.get(row.sale_id) ?? [];
    group.push(row);
    itemsBySale.set(row.sale_id, group);
  }
  return {
    ok: true as const,
    message: "",
    sales: sales.map((sale) => withCostFigures(sale, itemsBySale.get(sale.id) ?? [])),
  };
}

export async function getSale(id: string, consultas = false) {
  const supabase = await createClient();
  const auditQuery = consultas
    ? Promise.resolve({ data: [] })
    : supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, metadata, created_at, profiles(full_name)")
        .eq("entity_type", "sales")
        .eq("entity_id", id)
        .order("created_at", { ascending: false });
  const [sale, items, audit] = await Promise.all([
    supabase
      .from("sales_overview")
      .select(consultas ? CONSULTAS_SALE_OVERVIEW_COLUMNS : "*")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", id).order("created_at"),
    auditQuery,
  ]);

  if (sale.error) return { ok: false as const, message: sale.error.message };
  if (!sale.data) return { ok: false as const, message: "Venda não encontrada." };

  const logs = ((audit.data ?? []) as Array<AuditLog & { profiles?: { full_name: string } | { full_name: string }[] | null }>).map(
    (entry) => {
      const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
      return {
        id: entry.id,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        metadata: entry.metadata,
        created_at: entry.created_at,
        user_name: profile?.full_name ?? null,
      } satisfies AuditLog;
    },
  );

  return {
    ok: true as const,
    sale: withCostFigures(sale.data as unknown as SaleOverview, ((items.data ?? []) as SaleItem[]).map((item) => ({
      cost_price_unit: item.cost_price_unit,
      line_cost: item.line_cost,
      line_father_profit: item.line_father_profit,
    }))),
    items: (items.data ?? []) as SaleItem[],
    audit: logs,
  };
}
