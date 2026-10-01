import { createClient } from "@/lib/supabase/server";
import type { AuditLog, SaleItem, SaleOverview } from "@/lib/types";

export type SaleQuery = {
  from?: string;
  to?: string;
  productId?: string;
  customerTypeId?: string;
  paymentStatusId?: string;
  credit?: string;
  customer?: string;
  situation?: string;
  dueNow?: boolean;
  future?: boolean;
  paid?: boolean;
  openCredit?: boolean;
  limit?: number;
};

export async function listSales(query: SaleQuery = {}) {
  const supabase = await createClient();
  let request = supabase
    .from("sales_overview")
    .select("*")
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(query.limit ?? 200);

  if (query.from) request = request.gte("sale_date", query.from);
  if (query.to) request = request.lte("sale_date", query.to);
  if (query.productId) request = request.eq("product_id", query.productId);
  if (query.customerTypeId) request = request.eq("customer_type_id", query.customerTypeId);
  if (query.paymentStatusId) request = request.eq("payment_status_id", query.paymentStatusId);
  if (query.credit === "sim") request = request.eq("is_credit", true);
  if (query.credit === "nao") request = request.eq("is_credit", false);
  if (query.customer) request = request.ilike("customer_name", `%${query.customer}%`);
  if (query.situation !== "todas" && query.situation !== "canceladas") {
    request = request.eq("is_valid", true);
  }
  if (query.situation === "canceladas") request = request.eq("is_valid", false);
  if (query.dueNow) request = request.eq("transfer_due_now", true);
  if (query.future) request = request.eq("transfer_is_future", true);
  if (query.paid) request = request.eq("transfer_paid", true).eq("is_valid", true);
  if (query.openCredit) {
    request = request
      .eq("is_credit", true)
      .eq("counts_as_receivable", true)
      .eq("is_valid", true);
  }

  const { data, error } = await request;
  if (error) return { ok: false as const, message: error.message, sales: [] as SaleOverview[] };
  return { ok: true as const, message: "", sales: (data ?? []) as SaleOverview[] };
}

export async function getSale(id: string) {
  const supabase = await createClient();
  const [sale, items, audit] = await Promise.all([
    supabase.from("sales_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", id).order("created_at"),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, profiles(full_name)")
      .eq("entity_type", "sales")
      .eq("entity_id", id)
      .order("created_at", { ascending: false }),
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
    sale: sale.data as SaleOverview,
    items: (items.data ?? []) as SaleItem[],
    audit: logs,
  };
}
