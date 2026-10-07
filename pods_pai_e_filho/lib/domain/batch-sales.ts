import type { ConsultasFinancialSummary, Metrics, ReportRow, SaleOverview, SalesReport } from "../types";

/** One active allocation, with monetary values captured when the sale was made. */
export type BatchSaleLine = {
  sale: SaleOverview;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_name: string;
  variant_is_ice: boolean;
  quantity: number;
  unit_cost: string | null;
  /** Exact legacy item total, when supplied; allocations use quantity * unit_cost. */
  line_cost?: string | null;
  unit_transfer: string;
  unit_price: string;
};

type Figures = {
  revenue: number;
  transfer: number;
  profit: number;
  cost: number;
  fatherProfit: number;
  missingCost: boolean;
};

type SaleGroup = {
  sale: SaleOverview;
  lines: BatchSaleLine[];
  quantity: number;
  figures: Figures;
  missingItems: Set<string>;
};

const emptyFigures = (): Figures => ({ revenue: 0, transfer: 0, profit: 0, cost: 0, fatherProfit: 0, missingCost: false });

/** Parse decimal snapshots directly into cents, avoiding floating point rounding. */
function cents(value: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new Error("Snapshot monetário inválido.");
  const amount = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  const signed = match[1] ? -amount : amount;
  if (!Number.isSafeInteger(signed)) throw new Error("Snapshot monetário fora do limite de precisão.");
  return signed;
}

function money(amount: number): string {
  if (!Number.isSafeInteger(amount)) throw new Error("Total monetário fora do limite de precisão.");
  const absolute = Math.abs(amount);
  return `${amount < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function lineFigures(line: BatchSaleLine): Figures {
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
    throw new Error("Quantidade alocada inválida.");
  }
  const revenue = cents(line.unit_price) * line.quantity;
  const transfer = cents(line.unit_transfer) * line.quantity;
  const cost = line.line_cost !== undefined
    ? line.line_cost === null ? null : cents(line.line_cost)
    : line.unit_cost === null ? null : cents(line.unit_cost) * line.quantity;
  if (![revenue, transfer, cost ?? 0].every(Number.isSafeInteger)) {
    throw new Error("Total monetário fora do limite de precisão.");
  }
  return {
    revenue,
    transfer,
    cost: cost ?? 0,
    profit: revenue - transfer,
    fatherProfit: cost === null ? 0 : transfer - cost,
    missingCost: cost === null,
  };
}

function addFigures(total: Figures, figures: Figures) {
  total.revenue += figures.revenue;
  total.transfer += figures.transfer;
  total.profit += figures.profit;
  total.cost += figures.cost;
  total.fatherProfit += figures.fatherProfit;
  total.missingCost ||= figures.missingCost;
}

function groupSales(lines: readonly BatchSaleLine[]): SaleGroup[] {
  const groups = new Map<string, SaleGroup>();
  for (const line of lines) {
    let group = groups.get(line.sale.id);
    if (!group) {
      group = { sale: line.sale, lines: [], quantity: 0, figures: emptyFigures(), missingItems: new Set() };
      groups.set(line.sale.id, group);
    }
    group.lines.push(line);
    group.quantity += line.quantity;
    const figures = lineFigures(line);
    addFigures(group.figures, figures);
    if (figures.missingCost) group.missingItems.add(line.sale_item_id);
  }
  return [...groups.values()];
}

/**
 * Project only the supplied allocations. Input order determines sale/item order.
 * The loader must exclude reversed allocations; payment flags come from the sale.
 */
export function projectBatchSales(
  lines: readonly BatchSaleLine[],
  { consultas = false }: { consultas?: boolean } = {},
): SaleOverview[] {
  return groupSales(lines).map(({ sale, lines: saleLines, quantity, figures }) => {
    const first = saleLines[0];
    const items = new Map<string, BatchSaleLine>();
    for (const line of saleLines) if (!items.has(line.sale_item_id)) items.set(line.sale_item_id, line);
    const projected: SaleOverview = {
      ...sale,
      quantity,
      total_amount: money(figures.revenue),
      transfer_amount: money(figures.transfer),
      profit_amount: consultas ? "0.00" : money(figures.profit),
      cost_amount: figures.missingCost ? null : money(figures.cost),
      father_profit_amount: figures.missingCost ? null : money(figures.fatherProfit),
      cost_history_missing: figures.missingCost,
      items_label: [...items.values()].map((item) => `${item.product_name} · ${item.variant_name}`).join(", "),
      product_id: first.product_id,
      product_name: first.product_name,
      variant_id: first.variant_id,
      variant_name: first.variant_name,
      variant_is_ice: first.variant_is_ice,
      unit_price: money(cents(first.unit_price)),
      unit_transfer: money(cents(first.unit_transfer)),
      unit_profit: consultas ? "0.00" : money(cents(first.unit_price) - cents(first.unit_transfer)),
    };
    if (consultas) delete projected.is_credit;
    return projected;
  });
}

/** Match dashboard_metrics using existing payment flags, without inferring credit. */
export function metricsForBatchSales(lines: readonly BatchSaleLine[]): Metrics {
  const sales = groupSales(lines.filter((line) => line.sale.is_valid));
  const sum = (pick: (group: SaleGroup) => number) => money(sales.reduce((total, group) => total + pick(group), 0));
  return {
    money_received: sum(({ sale, figures }) => sale.counts_as_received ? figures.revenue : 0),
    receivable: sum(({ sale, figures }) => sale.counts_as_receivable && !sale.counts_as_received ? figures.revenue : 0),
    profit_received: sum(({ sale, figures }) => sale.counts_as_received ? figures.profit : 0),
    profit_total: sum(({ figures }) => figures.profit),
    transfer_from_received: sum(({ sale, figures }) => sale.counts_as_received ? figures.transfer : 0),
    transfer_future: sum(({ sale, figures }) => sale.transfer_is_future ? figures.transfer : 0),
    transfer_due_now: sum(({ sale, figures }) => sale.transfer_due_now ? figures.transfer : 0),
    transfer_total: sum(({ figures }) => figures.transfer),
    sales_count: sales.length,
    units_sold: sales.reduce((total, group) => total + group.quantity, 0),
  };
}

type ReportGroup = { id: string; name: string; quantity: number; figures: Figures };

function addReportGroup(groups: Map<string, ReportGroup>, id: string, name: string, line: BatchSaleLine, figures: Figures) {
  let group = groups.get(id);
  if (!group) {
    group = { id, name, quantity: 0, figures: emptyFigures() };
    groups.set(id, group);
  }
  group.quantity += line.quantity;
  addFigures(group.figures, figures);
}

function reportRows(groups: Map<string, ReportGroup>, stockByProduct?: Map<string, number>): ReportRow[] {
  return [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(({ id, name, quantity, figures }) => ({
      name,
      quantity,
      revenue: money(figures.revenue),
      transfer: money(figures.transfer),
      profit: money(figures.profit),
      ...(stockByProduct ? { stock: stockByProduct.get(id) ?? 0 } : {}),
    }));
}

/** Historical product names are taken from items, including inactive products. */
export function reportForBatchSales(
  lines: readonly BatchSaleLine[],
  stockByProduct: Map<string, number> = new Map(),
): SalesReport {
  const customers = new Map<string, ReportGroup>();
  const statuses = new Map<string, ReportGroup>();
  const products = new Map<string, ReportGroup>();
  for (const line of lines) {
    if (!line.sale.is_valid) continue;
    const figures = lineFigures(line);
    addReportGroup(customers, line.sale.customer_type_id, line.sale.customer_type_name, line, figures);
    addReportGroup(statuses, line.sale.payment_status_id, line.sale.payment_status_name, line, figures);
    addReportGroup(products, line.product_id, line.product_name, line, figures);
  }
  return {
    by_customer_type: reportRows(customers),
    by_status: reportRows(statuses),
    // This is current global stock supplied by the caller, not stock of the batch.
    by_product: reportRows(products, stockByProduct),
  };
}

/** Match CONSULTAS totals with exact allocation costs and no child-profit fields. */
export function consultasSummaryForBatchSales(
  lines: readonly BatchSaleLine[],
  stock?: Pick<ConsultasFinancialSummary, "stock_cost_total" | "stock_cost_missing_products">,
): ConsultasFinancialSummary {
  const sales = groupSales(lines.filter((line) => line.sale.is_valid));
  const sum = (pick: (group: SaleGroup) => number) => money(sales.reduce((total, group) => total + pick(group), 0));
  return {
    sales_count: sales.length,
    units_sold: sales.reduce((total, group) => total + group.quantity, 0),
    due_now_sales: sales.filter(({ sale }) => sale.transfer_due_now).length,
    future_sales: sales.filter(({ sale }) => sale.transfer_is_future).length,
    revenue: sum(({ figures }) => figures.revenue),
    cost_sold: sum(({ figures }) => figures.cost),
    cost_missing_items: sales.reduce((total, group) => total + group.missingItems.size, 0),
    transfer_total: sum(({ figures }) => figures.transfer),
    transfer_received: sum(({ sale, figures }) => sale.transfer_paid ? figures.transfer : 0),
    transfer_due_now: sum(({ sale, figures }) => sale.transfer_due_now ? figures.transfer : 0),
    transfer_future: sum(({ sale, figures }) => sale.transfer_is_future ? figures.transfer : 0),
    father_profit_total: sum(({ figures }) => figures.fatherProfit),
    father_profit_received: sum(({ sale, figures }) => sale.transfer_paid ? figures.fatherProfit : 0),
    father_profit_missing_items: sales.reduce((total, group) => total + group.missingItems.size, 0),
    father_profit_missing_received_items: sales.reduce((total, group) => total + (group.sale.transfer_paid ? group.missingItems.size : 0), 0),
    stock_cost_total: stock?.stock_cost_total ?? "0.00",
    stock_cost_missing_products: stock?.stock_cost_missing_products ?? 0,
  };
}
