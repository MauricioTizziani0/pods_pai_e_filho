import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Run the actual loaders with local dependencies; no credentials or database needed.
function loadTs(relativePath, dependencies = {}) {
  const filename = path.join(root, relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(source, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Dependência não simulada: ${name}`);
    },
  }, { filename });
  return compiledModule.exports;
}

const flavors = loadTs("lib/domain/flavors.ts");
const batchSales = loadTs("lib/domain/batch-sales.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

function sale(id, overrides = {}) {
  return {
    id, sale_date: "2026-10-07", created_at: "2026-10-07T12:00:00Z",
    customer_id: "alice", customer_name: "Alice", customer_type_id: "retail", customer_type_name: "Varejo",
    payment_status_id: "paid", payment_status_name: "Recebido", is_credit: false,
    is_valid: true, counts_as_received: true, counts_as_receivable: false,
    transfer_paid: false, transfer_due_now: true, transfer_is_future: false,
    // The first overview item intentionally differs from the matching secondary item.
    product_id: "other", product_name: "Outro produto", variant_name: "Mint", variant_is_ice: false,
    quantity: 7, total_amount: "480.05", transfer_amount: "360.05", profit_amount: "120.00",
    ...overrides,
  };
}

function item(id, saleId, overrides = {}) {
  return {
    id, sale_id: saleId, product_id: "live", product_name: "Pod atual", product_active: true,
    variant_id: "grape", variant_name: "Grape", product_variants: { name: "Grape", is_ice: true },
    quantity: 5, unit_price: "80.01", unit_transfer: "60.01", cost_price_unit: "30.00", line_cost: "150.01",
    ...overrides,
  };
}

function allocation(id, batchItemId, saleItemId, overrides = {}) {
  return {
    id, batch_item_id: batchItemId, sale_item_id: saleItemId, reversed_at: null,
    quantity: 2, unit_cost: "10.01", unit_price: "80.01", unit_transfer: "60.01",
    ...overrides,
  };
}

function harness(fixtures, { cap = 2, failTable, failOffset = 0 } = {}) {
  const requests = [];
  const saleQueries = [];
  const projections = [];
  const client = {
    from(table) {
      const request = { table, predicates: [], orderBy: [], from: 0, to: Infinity, columns: "*" };
      requests.push(request);
      const builder = {
        select(columns) { request.columns = columns; return this; },
        eq(column, value) { request.predicates.push(["eq", column, value]); return this; },
        in(column, values) { request.predicates.push(["in", column, [...values]]); return this; },
        is(column, value) { request.predicates.push(["is", column, value]); return this; },
        order(column) { request.orderBy.push(column); return this; },
        range(from, to) { request.from = from; request.to = to; return this; },
        then(resolve, reject) {
          if (table === failTable && request.from >= failOffset) {
            return Promise.resolve({ data: null, error: { message: "Falha simulada na página seguinte." } }).then(resolve, reject);
          }
          const filtered = (fixtures[table] ?? []).filter((row) => request.predicates.every(([operation, column, value]) =>
            operation === "in" ? value.includes(row[column]) : row[column] === value));
          filtered.sort((left, right) => {
            for (const column of request.orderBy) {
              const comparison = String(left[column]).localeCompare(String(right[column]));
              if (comparison) return comparison;
            }
            return 0;
          });
          const data = filtered.slice(request.from, Math.min(request.to + 1, request.from + cap));
          request.returned = data.length;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  async function listSales(query) {
    saleQueries.push(plain(query));
    let rows = (fixtures.sales ?? []).filter((row) => {
      if (query.saleIds && !query.saleIds.includes(row.id)) return false;
      if (query.from && row.sale_date < query.from) return false;
      if (query.to && row.sale_date > query.to) return false;
      if (query.customerTypeId && row.customer_type_id !== query.customerTypeId) return false;
      if (query.paymentStatusId && row.payment_status_id !== query.paymentStatusId) return false;
      if (query.customerId && row.customer_id !== query.customerId) return false;
      if (query.customer && !row.customer_name.toLowerCase().includes(query.customer.toLowerCase())) return false;
      if (!query.consultas && query.credit === "sim" && !row.is_credit) return false;
      if (!query.consultas && query.credit === "nao" && row.is_credit) return false;
      if (query.situation === "canceladas" ? row.is_valid : query.situation !== "todas" && !row.is_valid) return false;
      if (query.dueNow && !row.transfer_due_now) return false;
      if (query.future && !row.transfer_is_future) return false;
      if (query.paid && (!row.transfer_paid || !row.is_valid)) return false;
      if (!query.consultas && query.openCredit && (!row.is_credit || !row.counts_as_receivable || !row.is_valid)) return false;
      return true;
    });
    rows = rows.sort((left, right) => right.sale_date.localeCompare(left.sale_date) || right.id.localeCompare(left.id));
    const offset = query.offset ?? 0;
    const result = rows.slice(offset, offset + Math.min(query.limit ?? 200, cap));
    saleQueries.at(-1).returned = result.length;
    return { ok: true, sales: result, message: "" };
  }
  const { loadFinancialSales } = loadTs("lib/data/financial-sales.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/data/sales": { listSales },
    "@/lib/domain/batch-sales": {
      projectBatchSales(lines, options) {
        projections.push({ lines, options });
        return batchSales.projectBatchSales(lines, options);
      },
    },
    "@/lib/domain/flavors": flavors,
    "@/lib/errors": { dbErrorMessage: (error) => error.message },
  });
  return { loadFinancialSales, requests, saleQueries, projections };
}

const fixtures = {
  sales: [
    sale("mixed"),
    sale("legacy", { customer_name: "Legado", product_id: "inactive" }),
    sale("old", { sale_date: "2026-09-01" }),
    sale("unpaid", { customer_id: "bob", customer_name: "Bob", customer_type_id: "wholesale", payment_status_id: "waiting", is_credit: true, counts_as_received: false, counts_as_receivable: true }),
    sale("cancelled", { is_valid: false }),
    sale("reversed"),
  ],
  sale_items: [
    item("main-item", "mixed"),
    item("other-item", "mixed", { product_id: "other", product_name: "Outro produto", variant_name: "Mint", product_variants: [{ name: "Mint", is_ice: false }], quantity: 2, unit_price: "40.00", unit_transfer: "30.00", cost_price_unit: "20.00", line_cost: "40.00" }),
    item("legacy-item", "legacy", { product_id: "inactive", product_name: "Pod inativo histórico", product_active: false, variant_name: "Strawberry", product_variants: null, quantity: 3, unit_price: "25.50", unit_transfer: "20.25", cost_price_unit: null, line_cost: null }),
    item("old-item", "old", { quantity: 1, line_cost: "30.00" }),
    item("unpaid-item", "unpaid", { quantity: 1, line_cost: "30.00" }),
    item("cancelled-item", "cancelled", { quantity: 100, line_cost: "3000.00" }),
    item("reversed-item", "reversed", { variant_name: "Orange", product_variants: [{ name: "Orange", is_ice: false }], quantity: 1, line_cost: "30.00" }),
  ],
  batch_items: [
    { id: "b1-main", batch_id: "b1" }, { id: "b1-other", batch_id: "b1" },
    { id: "b1-old", batch_id: "b1" }, { id: "b1-unpaid", batch_id: "b1" },
    { id: "b1-cancelled", batch_id: "b1" }, { id: "b1-reversed", batch_id: "b1" },
    { id: "b2-main", batch_id: "b2" },
  ],
  sale_item_batch_allocations: [
    allocation("a-main-b1", "b1-main", "main-item"),
    allocation("a-main-b2", "b2-main", "main-item", { quantity: 3, unit_cost: "25.00" }),
    allocation("a-other", "b1-other", "other-item", { quantity: 2, unit_cost: "20.00", unit_price: "40.00", unit_transfer: "30.00" }),
    allocation("a-old", "b1-old", "old-item", { quantity: 1 }),
    allocation("a-unpaid", "b1-unpaid", "unpaid-item", { quantity: 1 }),
    allocation("a-cancelled", "b1-cancelled", "cancelled-item", { quantity: 100 }),
    allocation("a-reversed", "b1-reversed", "reversed-item", { quantity: 90, reversed_at: "2026-10-07T13:00:00Z" }),
  ],
};

const metadata = {
  from: "2026-10-01", to: "2026-10-07", customerId: "alice", customer: "Ali",
  customerTypeId: "retail", paymentStatusId: "paid", credit: "nao", dueNow: true,
};

function figures(result, id) {
  assert.equal(result.ok, true, result.message);
  const value = result.sales.find((row) => row.id === id);
  assert.ok(value, `Venda ausente: ${id}`);
  return plain({ quantity: value.quantity, revenue: value.total_amount, transfer: value.transfer_amount, cost: value.cost_amount, profit: value.profit_amount, fatherProfit: value.father_profit_amount });
}

// Product/flavor filters match items, including an item not represented by sales_overview.
const filtered = harness(fixtures);
const selected = await filtered.loadFinancialSales({ ...metadata, batchId: "b1", productId: "live", ice: "ice", flavor: "Grape Ice", situation: "todas" });
assert.deepEqual(figures(selected, "mixed"), { quantity: 2, revenue: "160.02", transfer: "120.02", cost: "20.02", profit: "40.00", fatherProfit: "100.00" });
assert.deepEqual(plain(selected.lines.map((line) => line.sale_item_id)), ["main-item"]);
assert.equal(selected.lines[0].variant_name, "Grape Ice");
for (const query of filtered.saleQueries) {
  for (const [key, value] of Object.entries(metadata)) assert.equal(query[key], value, `Metadado não preservado: ${key}`);
  for (const key of ["batchId", "productId", "ice", "flavor", "situation"]) assert.equal(query[key], undefined, `Filtro de item aplicado à venda: ${key}`);
  assert.equal(query.includeCosts, false);
  assert.equal(query.limit, 500);
}
assert.ok(filtered.requests.filter((request) => request.table === "sale_items").every((request) => request.predicates.some(([operation, column, value]) => operation === "eq" && column === "product_id" && value === "live")));
assert.ok(filtered.requests.filter((request) => request.table === "sale_item_batch_allocations").every((request) => request.predicates.some(([operation, column, value]) => operation === "is" && column === "reversed_at" && value === null)));

const batch = harness(fixtures);
const allBatchItems = await batch.loadFinancialSales({ ...metadata, batchId: "b1" });
assert.deepEqual(figures(allBatchItems, "mixed"), { quantity: 4, revenue: "240.02", transfer: "180.02", cost: "60.02", profit: "60.00", fatherProfit: "120.00" });
assert.equal(allBatchItems.lines.some((line) => line.sale.id === "reversed" || line.sale.id === "cancelled" || line.sale.id === "old" || line.sale.id === "unpaid"), false);
const otherPortion = await batch.loadFinancialSales({ ...metadata, batchId: "b2" });
assert.deepEqual(figures(otherPortion, "mixed"), { quantity: 3, revenue: "240.03", transfer: "180.03", cost: "75.00", profit: "60.00", fatherProfit: "105.03" });

// General results use the full historical item once, not one copy for each batch.
const general = harness(fixtures);
const full = await general.loadFinancialSales();
assert.deepEqual(figures(full, "mixed"), { quantity: 7, revenue: "480.05", transfer: "360.05", cost: "190.01", profit: "120.00", fatherProfit: "170.04" });
assert.deepEqual(figures(full, "legacy"), { quantity: 3, revenue: "76.50", transfer: "60.75", cost: null, profit: "15.75", fatherProfit: null });
assert.equal(full.sales.find((row) => row.id === "legacy").cost_history_missing, true);
assert.equal(full.lines.filter((line) => line.sale_item_id === "main-item").length, 1);
assert.equal(general.requests.some((request) => ["products", "batch_items", "sale_item_batch_allocations"].includes(request.table)), false);
assert.equal(full.sales.some((row) => row.id === "cancelled"), false);

const fullFiltered = await general.loadFinancialSales({ ...metadata, productId: "live", ice: "sim", flavor: "grape ice" });
assert.deepEqual(figures(fullFiltered, "mixed"), { quantity: 5, revenue: "400.05", transfer: "300.05", cost: "150.01", profit: "100.00", fatherProfit: "150.04" });
assert.equal(fullFiltered.sales.length, 1);

// Customer text follows the same trimming as the existing financial RPC filters.
const paddedCustomer = harness(fixtures);
const paddedResult = await paddedCustomer.loadFinancialSales({ ...metadata, customer: " Alice ", batchId: "b1", productId: "live" });
assert.deepEqual(figures(paddedResult, "mixed"), { quantity: 2, revenue: "160.02", transfer: "120.02", cost: "20.02", profit: "40.00", fatherProfit: "100.00" });
assert.ok(paddedCustomer.saleQueries.every((query) => query.customer === "Alice"));
const blankCustomer = harness(fixtures);
const blankResult = await blankCustomer.loadFinancialSales({ customer: "   " });
assert.equal(blankResult.ok, true, blankResult.message);
assert.deepEqual(plain(blankResult.sales.map((row) => row.id).sort()), plain(full.sales.map((row) => row.id).sort()));
assert.ok(blankCustomer.saleQueries.every((query) => query.customer === undefined));

const nonIce = await general.loadFinancialSales({ ...metadata, productId: "other", ice: "nao", flavor: "Mint" });
assert.deepEqual(figures(nonIce, "mixed"), { quantity: 2, revenue: "80.00", transfer: "60.00", cost: "40.00", profit: "20.00", fatherProfit: "20.00" });
const empty = await general.loadFinancialSales({ batchId: "missing" });
assert.equal(empty.ok, true);
assert.equal(empty.lines.length, 0);
assert.equal(empty.sales.length, 0);

const consultas = harness(fixtures);
const readonly = await consultas.loadFinancialSales({ ...metadata, batchId: "b1", productId: "live", consultas: true });
assert.equal(readonly.sales[0].profit_amount, "0.00");
assert.equal(readonly.sales[0].unit_profit, "0.00");
assert.equal(Object.hasOwn(readonly.sales[0], "is_credit"), false);
assert.equal(readonly.sales[0].cost_amount, "20.02");
assert.equal(consultas.projections[0].options.consultas, true);
assert.ok(consultas.saleQueries.every((query) => query.consultas === true));

// 105 IDs exercise both 100-ID chunks and short server pages for every source.
const many = { sales: [], sale_items: [], batch_items: [], sale_item_batch_allocations: [] };
for (let index = 0; index < 105; index++) {
  const suffix = String(index).padStart(3, "0");
  many.sales.push(sale(`sale-${suffix}`));
  many.sale_items.push(item(`item-${suffix}`, `sale-${suffix}`, { quantity: 1, unit_price: "1.01", unit_transfer: "0.77", cost_price_unit: "0.30", line_cost: "0.30" }));
  many.batch_items.push({ id: `batch-item-${suffix}`, batch_id: "many" });
  many.sale_item_batch_allocations.push(allocation(`allocation-${suffix}`, `batch-item-${suffix}`, `item-${suffix}`, { quantity: 1, unit_price: "1.01", unit_transfer: "0.77", unit_cost: "0.30" }));
}
function totalCents(rows, column) { return rows.reduce((total, row) => total + Math.round(Number(row[column]) * 100), 0); }
for (const query of [{}, { batchId: "many" }]) {
  const paged = harness(many, { cap: 3 });
  const result = await paged.loadFinancialSales(query);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.lines.length, 105);
  assert.equal(result.sales.length, 105);
  assert.equal(totalCents(result.sales, "total_amount"), 10605);
  assert.equal(totalCents(result.sales, "transfer_amount"), 8085);
  assert.equal(totalCents(result.sales, "cost_amount"), 3150);
  assert.equal(totalCents(result.sales, "profit_amount"), 2520);
  assert.ok(paged.saleQueries.some((entry) => entry.offset === 3));
  assert.ok(paged.saleQueries.some((entry) => entry.returned === 0));
  assert.ok(paged.requests.some((request) => request.from === 3));
  assert.ok(paged.requests.every((request) => request.to === request.from + 499));
  assert.ok(paged.requests.some((request) => request.returned === 0));
  if (query.batchId) {
    assert.ok(paged.saleQueries.some((entry) => entry.saleIds?.length === 100));
    assert.ok(paged.saleQueries.some((entry) => entry.saleIds?.length === 5));
    assert.equal(paged.requests.filter((request) => request.table === "batch_items").at(-1).from, 105);
  } else {
    assert.equal(paged.saleQueries.at(-1).offset, 105);
  }
}

const failure = await harness(many, { cap: 2, failTable: "sale_items", failOffset: 2 }).loadFinancialSales();
assert.equal(failure.ok, false);
assert.equal(failure.message, "Falha simulada na página seguinte.");
assert.equal(failure.lines.length, 0);
assert.equal(failure.sales.length, 0);

console.log("Filtros financeiros OK: snapshots de lote, reversões, metadados, produtos/Ice/sabores, legado inativo, CONSULTAS e paginação completa.");
