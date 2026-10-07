import assert from "node:assert/strict";
import {
  consultasSummaryForBatchSales,
  metricsForBatchSales,
  projectBatchSales,
  reportForBatchSales,
  type BatchSaleLine,
} from "../lib/domain/batch-sales.ts";
import type { SaleOverview } from "../lib/types.ts";

function sale(id: string, changes: Partial<SaleOverview> = {}): SaleOverview {
  return {
    id,
    sale_date: "2026-10-07",
    customer_id: "customer",
    customer_name: "Cliente",
    customer_type_id: "regular",
    customer_type_name: "Normal",
    payment_status_id: "received",
    payment_status_code: "RECEBIDO",
    payment_status_name: "Recebido",
    is_credit: false,
    notes: "Histórico original",
    total_amount: "300.00",
    transfer_amount: "250.00",
    profit_amount: "50.00",
    transfer_paid: false,
    transfer_paid_at: null,
    transfer_id: null,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    created_by: null,
    created_at: "2026-10-07T12:00:00Z",
    counts_as_received: true,
    counts_as_receivable: false,
    is_terminal: false,
    is_valid: true,
    transfer_due_now: true,
    transfer_is_future: false,
    quantity: 2,
    items_label: "Produto de outra parcela · Sabor de outra parcela",
    product_id: "other-product",
    product_name: "Produto de outra parcela",
    variant_id: "other-variant",
    variant_name: "Sabor de outra parcela",
    variant_is_ice: false,
    unit_price: "999.99",
    unit_transfer: "888.88",
    unit_profit: "111.11",
    cost_amount: "234.56",
    father_profit_amount: "15.44",
    cost_history_missing: true,
    ...changes,
  };
}

function line(saleRow: SaleOverview, changes: Partial<BatchSaleLine> = {}): BatchSaleLine {
  return {
    sale: saleRow,
    sale_item_id: `item-${saleRow.id}`,
    product_id: "pod",
    product_name: "Pod histórico",
    variant_id: "grape",
    variant_name: "Uva",
    variant_is_ice: true,
    quantity: 1,
    unit_cost: "100.00",
    unit_transfer: "125.00",
    unit_price: "150.00",
    ...changes,
  };
}

// A sale with two units allocated to two batches. Selecting the second batch
// projects R$150 and its own R$110 cost, rather than the full R$300 sale.
const originalSale = sale("multi-batch");
const firstBatch = line(originalSale);
const secondBatch = line(originalSale, { unit_cost: "110.00" });
const selected = projectBatchSales([secondBatch])[0];
assert.equal(selected.total_amount, "150.00");
assert.equal(selected.transfer_amount, "125.00");
assert.equal(selected.profit_amount, "25.00");
assert.equal(selected.cost_amount, "110.00");
assert.equal(selected.father_profit_amount, "15.00");
assert.equal(selected.quantity, 1);
assert.equal(selected.cost_history_missing, false);
assert.equal(selected.items_label, "Pod histórico · Uva");
assert.equal(selected.product_id, "pod");
assert.equal(selected.variant_id, "grape");
assert.equal(selected.variant_is_ice, true);
assert.equal(selected.unit_price, "150.00");
assert.equal(selected.unit_transfer, "125.00");
assert.equal(selected.unit_profit, "25.00");
assert.equal(selected.notes, originalSale.notes);

const bothBatches = projectBatchSales([firstBatch, secondBatch]);
assert.equal(bothBatches.length, 1);
assert.equal(bothBatches[0].quantity, 2);
assert.equal(bothBatches[0].total_amount, "300.00");
assert.equal(bothBatches[0].cost_amount, "210.00");
assert.equal(bothBatches[0].father_profit_amount, "40.00");
assert.equal(bothBatches[0].items_label, "Pod histórico · Uva");
assert.equal(metricsForBatchSales([firstBatch, secondBatch]).sales_count, 1);
assert.equal(metricsForBatchSales([firstBatch, secondBatch]).units_sold, 2);
assert.equal(consultasSummaryForBatchSales([firstBatch, secondBatch]).due_now_sales, 1);

const otherItem = line(originalSale, {
  sale_item_id: "other-item",
  product_id: "other-pod",
  product_name: "Outro pod",
  variant_id: "mint",
  variant_name: "Menta",
  variant_is_ice: false,
});
const multipleItems = projectBatchSales([firstBatch, secondBatch, otherItem])[0];
assert.equal(multipleItems.items_label, "Pod histórico · Uva, Outro pod · Menta");
assert.equal(multipleItems.quantity, 3);
assert.equal(multipleItems.product_id, "pod");

// CONSULTAS can receive payment flags without receiving is_credit itself.
const hiddenCredit = sale("credit", {
  payment_status_id: "pending",
  payment_status_code: "A_RECEBER",
  payment_status_name: "A receber",
  counts_as_received: false,
  counts_as_receivable: true,
  transfer_due_now: true,
  transfer_is_future: false,
});
delete hiddenCredit.is_credit;
const paid = sale("paid", {
  transfer_paid: true,
  transfer_paid_at: "2026-10-07T13:00:00Z",
  transfer_id: "transfer",
  transfer_due_now: false,
});
const future = sale("future", {
  payment_status_id: "pending",
  payment_status_code: "A_RECEBER",
  payment_status_name: "A receber",
  counts_as_received: false,
  counts_as_receivable: true,
  transfer_due_now: false,
  transfer_is_future: true,
});
const neither = sale("neither", {
  payment_status_id: "other",
  payment_status_code: "OUTRO",
  payment_status_name: "Outro",
  counts_as_received: false,
  counts_as_receivable: false,
  transfer_due_now: false,
});
const overlap = sale("overlap", { counts_as_receivable: true });
const cancelled = sale("cancelled", {
  is_valid: false,
  cancelled_at: "2026-10-07T14:00:00Z",
  // Even unexpected true flags must not reintroduce an invalid sale.
  transfer_due_now: true,
  transfer_is_future: true,
});
const terminal = sale("terminal", { is_valid: false, is_terminal: true });
const allLines = [
  firstBatch,
  secondBatch,
  line(hiddenCredit),
  line(paid, { unit_price: "130.00" }),
  line(future, { unit_price: "140.00", unit_transfer: "115.00", unit_cost: "90.00" }),
  line(neither, { product_id: "inactive", product_name: "Pod desativado", unit_price: "99.00", unit_transfer: "80.00", unit_cost: "70.00" }),
  line(overlap, { unit_price: "110.00", unit_transfer: "90.00", unit_cost: "65.00" }),
  line(cancelled, { quantity: 4, unit_price: "999.00" }),
  line(terminal),
];
const before = JSON.stringify(allLines);

assert.deepEqual(metricsForBatchSales(allLines), {
  money_received: "540.00",
  receivable: "290.00",
  profit_received: "75.00",
  profit_total: "144.00",
  transfer_from_received: "465.00",
  transfer_future: "115.00",
  transfer_due_now: "465.00",
  transfer_total: "785.00",
  sales_count: 6,
  units_sold: 7,
});
assert.equal(projectBatchSales([line(cancelled)])[0].is_valid, false);

const stock = { stock_cost_total: "1234.50", stock_cost_missing_products: 2 };
const summary = consultasSummaryForBatchSales(allLines, stock);
assert.deepEqual(summary, {
  sales_count: 6,
  units_sold: 7,
  due_now_sales: 3,
  future_sales: 1,
  revenue: "929.00",
  cost_sold: "635.00",
  cost_missing_items: 0,
  transfer_total: "785.00",
  transfer_received: "125.00",
  transfer_due_now: "465.00",
  transfer_future: "115.00",
  father_profit_total: "150.00",
  father_profit_received: "25.00",
  father_profit_missing_items: 0,
  father_profit_missing_received_items: 0,
  ...stock,
});
assert.equal("profit_total" in summary, false);
assert.equal("child_profit" in summary, false);
assert.equal("is_credit" in summary, false);

const consultasSales = projectBatchSales(allLines, { consultas: true });
assert(consultasSales.every((row) => row.profit_amount === "0.00" && row.unit_profit === "0.00"));
assert(consultasSales.every((row) => !("is_credit" in row)));
assert.equal(consultasSales[0].father_profit_amount, "40.00");
assert.equal(consultasSales.find((row) => row.id === "credit")?.transfer_due_now, true);

const report = reportForBatchSales(allLines, new Map([["pod", 7], ["inactive", 31]]));
assert.deepEqual(report.by_product, [
  { name: "Pod desativado", quantity: 1, revenue: "99.00", transfer: "80.00", profit: "19.00", stock: 31 },
  { name: "Pod histórico", quantity: 6, revenue: "830.00", transfer: "705.00", profit: "125.00", stock: 7 },
]);
assert.deepEqual(report.by_customer_type, [
  { name: "Normal", quantity: 7, revenue: "929.00", transfer: "785.00", profit: "144.00" },
]);
assert.deepEqual(report.by_status, [
  { name: "A receber", quantity: 2, revenue: "290.00", transfer: "240.00", profit: "50.00" },
  { name: "Outro", quantity: 1, revenue: "99.00", transfer: "80.00", profit: "19.00" },
  { name: "Recebido", quantity: 4, revenue: "540.00", transfer: "465.00", profit: "75.00" },
]);

// Group by stable ids even when the historical display name changed.
const renamed = reportForBatchSales([
  firstBatch,
  { ...secondBatch, product_name: "Nome posterior", sale: { ...originalSale, customer_type_name: "Nome posterior", payment_status_name: "Nome posterior" } },
], new Map([["pod", 11]]));
assert.equal(renamed.by_product.length, 1);
assert.equal(renamed.by_product[0].stock, 11);
assert.equal(renamed.by_customer_type.length, 1);
assert.equal(renamed.by_status.length, 1);

const fractional = line(sale("fractional"), {
  quantity: 3,
  unit_price: "100.10",
  unit_transfer: "90.01",
  unit_cost: "80.09",
});
const exact = projectBatchSales([fractional])[0];
assert.equal(exact.total_amount, "300.30");
assert.equal(exact.transfer_amount, "270.03");
assert.equal(exact.cost_amount, "240.27");
assert.equal(exact.profit_amount, "30.27");
assert.equal(exact.father_profit_amount, "29.76");

// The general report can use sale items directly, including unallocated legacy
// items. Their unknown cost stays unknown, while exact saved line costs prevail.
const legacy = line(sale("legacy", { transfer_paid: true, transfer_due_now: false }), {
  quantity: 2,
  unit_cost: null,
  line_cost: null,
  product_id: "legacy-inactive",
  product_name: "Legado desativado",
});
const exactLegacy = line(sale("legacy-exact"), {
  quantity: 3,
  unit_cost: "70.01",
  line_cost: "210.01",
});
const legacyProjection = projectBatchSales([legacy])[0];
assert.equal(legacyProjection.cost_amount, null);
assert.equal(legacyProjection.father_profit_amount, null);
assert.equal(legacyProjection.cost_history_missing, true);
assert.equal(projectBatchSales([exactLegacy])[0].cost_amount, "210.01");
assert.equal(projectBatchSales([exactLegacy])[0].father_profit_amount, "164.99");
const legacySummary = consultasSummaryForBatchSales([legacy, exactLegacy], stock);
assert.equal(legacySummary.cost_sold, "210.01");
assert.equal(legacySummary.cost_missing_items, 1);
assert.equal(legacySummary.father_profit_total, "164.99");
assert.equal(legacySummary.father_profit_received, "0.00");
assert.equal(legacySummary.father_profit_missing_items, 1);
assert.equal(legacySummary.father_profit_missing_received_items, 1);
assert.equal(legacySummary.stock_cost_total, stock.stock_cost_total);
const generalReport = reportForBatchSales([firstBatch, secondBatch, legacy, exactLegacy]);
assert.equal(generalReport.by_product.find((row) => row.name === "Legado desativado")?.revenue, "300.00");
assert.equal(generalReport.by_customer_type[0].revenue, "1050.00");

assert.equal(JSON.stringify(allLines), before, "Pure projections must preserve source objects.");
assert.equal(originalSale.total_amount, "300.00");
assert.equal(originalSale.cost_amount, "234.56");
assert.equal(originalSale.profit_amount, "50.00");
assert.equal(originalSale.is_credit, false);
assert.deepEqual(projectBatchSales([]), []);
assert.equal(metricsForBatchSales([]).sales_count, 0);
assert.deepEqual(reportForBatchSales([]), { by_customer_type: [], by_status: [], by_product: [] });
assert.equal(consultasSummaryForBatchSales([], stock).stock_cost_total, stock.stock_cost_total);

console.log("Projeções financeiras por lote conferidas: parcelas, pagamentos, cancelamentos, legado e CONSULTAS.");
