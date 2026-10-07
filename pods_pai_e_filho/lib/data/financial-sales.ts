import { createClient } from "@/lib/supabase/server";
import { listSales, type SaleQuery } from "@/lib/data/sales";
import { projectBatchSales, type BatchSaleLine } from "@/lib/domain/batch-sales";
import { getFlavorDisplayName, iceFilterToBool, matchesFlavorSearch, parseIceParam } from "@/lib/domain/flavors";
import { dbErrorMessage } from "@/lib/errors";
import type { SaleOverview } from "@/lib/types";

type Allocation = {
  sale_item_id: string;
  quantity: number;
  unit_cost: string;
  unit_price: string;
  unit_transfer: string;
};
type Item = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_name: string;
  quantity: number;
  unit_price: string;
  unit_transfer: string;
  cost_price_unit: string | null;
  line_cost: string | null;
  product_variants: { name: string; is_ice: boolean } | { name: string; is_ice: boolean }[] | null;
};
type RowsResult = { data: unknown[] | null; error: { message: string; code?: string } | null };
const PAGE_SIZE = 500;

// Continue until an empty page, even if the server caps responses below PAGE_SIZE.
async function readAll<T>(request: (from: number, to: number) => PromiseLike<RowsResult>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const result = await request(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error) throw new Error(dbErrorMessage(result.error));
    const page = (result.data ?? []) as T[];
    if (page.length === 0) return rows;
    rows.push(...page);
  }
}

function chunks<T>(values: T[]): T[][] {
  return Array.from({ length: Math.ceil(values.length / 100) }, (_, index) => values.slice(index * 100, (index + 1) * 100));
}

/** Reuse sale filters and existing allocation snapshots without changing stock rules. */
export async function loadFinancialSales(query: SaleQuery = {}) {
  const supabase = await createClient();
  const metadataQuery: SaleQuery = {
    ...query,
    batchId: undefined,
    productId: undefined,
    ice: undefined,
    flavor: undefined,
    customer: query.customer?.trim() || undefined,
    situation: undefined,
    includeCosts: false,
  };
  try {
    const allocations: Allocation[] = [];
    let items: Item[] = [];
    let sales: SaleOverview[] = [];

    const readItems = async (column: "id" | "sale_id", ids: string[]) => {
      const result: Item[] = [];
      for (const group of chunks(ids)) {
        result.push(...await readAll<Item>((from, to) => {
          let request = supabase.from("sale_items")
            .select("id, sale_id, product_id, product_name, variant_id, variant_name, quantity, unit_price, unit_transfer, cost_price_unit, line_cost, product_variants(name, is_ice)")
            .in(column, group);
          if (query.productId) request = request.eq("product_id", query.productId);
          return request.order("id").range(from, to);
        }));
      }
      return result;
    };
    const readSales = async (ids?: string[]) => {
      const result: SaleOverview[] = [];
      for (const group of ids ? chunks(ids) : [undefined]) {
        let offset = 0;
        for (;;) {
          const page = await listSales({ ...metadataQuery, saleIds: group, offset, limit: PAGE_SIZE });
          if (!page.ok) throw new Error(page.message);
          if (page.sales.length === 0) break;
          result.push(...page.sales);
          offset += page.sales.length;
        }
      }
      return result;
    };

    if (query.batchId) {
      const batchItems = await readAll<{ id: string }>((from, to) => supabase.from("batch_items")
        .select("id").eq("batch_id", query.batchId!).order("id").range(from, to));
      for (const group of chunks(batchItems.map((item) => item.id))) {
        allocations.push(...await readAll<Allocation>((from, to) => supabase.from("sale_item_batch_allocations")
          .select("sale_item_id, quantity, unit_cost, unit_price, unit_transfer")
          .in("batch_item_id", group).is("reversed_at", null).order("id").range(from, to)));
      }
      items = await readItems("id", [...new Set(allocations.map((allocation) => allocation.sale_item_id))]);
    } else {
      sales = await readSales();
      items = await readItems("sale_id", sales.map((sale) => sale.id));
    }

    const ice = iceFilterToBool(parseIceParam(query.ice));
    const variantFor = (item: Item) => Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants;
    items = items.filter((item) => {
      const variant = variantFor(item);
      if (ice !== null && Boolean(variant?.is_ice) !== ice) return false;
      return !query.flavor || matchesFlavorSearch({ name: item.variant_name, is_ice: variant?.is_ice }, query.flavor)
        || Boolean(variant && matchesFlavorSearch(variant, query.flavor));
    });
    if (query.batchId) sales = await readSales([...new Set(items.map((item) => item.sale_id))]);
    const saleById = new Map(sales.map((sale) => [sale.id, sale]));
    const itemById = new Map(items.map((item) => [item.id, item]));
    const lines: BatchSaleLine[] = [];
    const append = (item: Item, figures: Pick<BatchSaleLine, "quantity" | "unit_cost" | "unit_price" | "unit_transfer" | "line_cost">) => {
      const sale = saleById.get(item.sale_id);
      if (!sale) return;
      const isIce = Boolean(variantFor(item)?.is_ice);
      lines.push({
        sale, sale_item_id: item.id, product_id: item.product_id, product_name: item.product_name,
        variant_id: item.variant_id,
        variant_name: getFlavorDisplayName({ name: item.variant_name, is_ice: isIce }),
        variant_is_ice: isIce,
        ...figures,
      });
    };
    if (query.batchId) {
      for (const allocation of allocations) {
        const item = itemById.get(allocation.sale_item_id);
        if (item) append(item, {
          quantity: allocation.quantity, unit_cost: String(allocation.unit_cost),
          unit_price: String(allocation.unit_price), unit_transfer: String(allocation.unit_transfer),
        });
      }
    } else {
      // One full historical item per line, including legacy sales without allocations.
      for (const item of items) append(item, {
        quantity: item.quantity, unit_cost: item.cost_price_unit === null ? null : String(item.cost_price_unit),
        line_cost: item.line_cost === null ? null : String(item.line_cost),
        unit_price: String(item.unit_price), unit_transfer: String(item.unit_transfer),
      });
    }
    const projected = projectBatchSales(lines, { consultas: query.consultas }).sort((a, b) =>
      b.sale_date.localeCompare(a.sale_date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return { ok: true as const, message: "", lines, sales: projected };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Não foi possível carregar os resultados financeiros.", lines: [] as BatchSaleLine[], sales: [] as SaleOverview[] };
  }
}
