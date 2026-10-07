import assert from "node:assert/strict";
import {
  buildFilterUrl,
  formatBatchLabel,
  resolveBatchFilter,
} from "../lib/domain/batch-filters.ts";
import type { BatchOverview } from "../lib/types.ts";

function batch(
  id: string,
  number: number,
  status: BatchOverview["status"],
  purchaseDate: string,
  createdAt = `${purchaseDate}T12:00:00.000Z`,
): BatchOverview {
  return {
    batch_id: id,
    batch_number: number,
    purchase_date: purchaseDate,
    notes: null,
    is_legacy: false,
    status,
    created_by: null,
    created_at: createdAt,
    closed_at: null,
    total_purchased: 10,
    quantity_sold: 0,
    quantity_remaining: 10,
    capital_invested: "100",
    capital_in_stock: "100",
    capital_recovered: "0",
    revenue: "0",
    revenue_received: "0",
    revenue_receivable: "0",
    transfer_total: "0",
    transfer_paid: "0",
    transfer_due_now: "0",
    transfer_future: "0",
    father_profit: "0",
    child_profit: "0",
    total_profit: "0",
    last_sale_date: null,
    has_sales: false,
    duration_days: null,
  };
}

const olderOpen = batch("open-old", 20, "ABERTO", "2026-09-20", "2026-10-07T15:00:00.000Z");
const newerOpen = batch("open-new", 8, "ABERTO", "2026-10-01");
const olderFinalized = batch("finished-old", 5, "FINALIZADO", "2026-08-01");
const newerFinalized = batch("finished-new", 21, "FINALIZADO", "2026-10-06");
const cancelled = batch("cancelled", 22, "CANCELADO", "2026-10-07");
const allBatches = [olderOpen, cancelled, newerFinalized, newerOpen, olderFinalized];
const originalOrder = allBatches.map((item) => item.batch_id);

// An open batch always takes precedence; purchase date precedes creation date and number.
const defaultFilter = resolveBatchFilter(allBatches, undefined);
assert.deepEqual(defaultFilter, {
  batch: newerOpen,
  batchId: newerOpen.batch_id,
  value: newerOpen.batch_id,
  label: "Lote 008 — Em andamento",
  shouldCanonicalize: true,
});
assert.deepEqual(allBatches.map((item) => item.batch_id), originalOrder, "seleção não altera a ordem da lista");

// With no open batches, use the latest finalized one and never choose a cancelled batch automatically.
assert.equal(
  resolveBatchFilter([olderFinalized, cancelled, newerFinalized], undefined).batchId,
  newerFinalized.batch_id,
  "último finalizado quando não há lote aberto",
);
for (const batches of [[], [cancelled]]) {
  assert.deepEqual(resolveBatchFilter(batches, undefined), {
    batch: null,
    batchId: null,
    value: "todos",
    label: "Todos os lotes",
    shouldCanonicalize: true,
  }, "sem lote elegível a página usa visão geral");
}

// Creation time, batch number, then id resolve otherwise identical purchase dates.
const earlierCreated = batch("created-first", 50, "ABERTO", "2026-10-01", "2026-10-02T12:00:00.000Z");
const laterCreated = batch("created-last", 4, "ABERTO", "2026-10-01", "2026-10-02T10:00:00.000-03:00");
assert.equal(
  resolveBatchFilter([earlierCreated, laterCreated], undefined).batchId,
  laterCreated.batch_id,
  "criação compara instantes inclusive com fuso diferente",
);
const lowerNumber = batch("number-low", 7, "ABERTO", "2026-10-01");
const higherNumber = batch("number-high", 9, "ABERTO", "2026-10-01");
assert.equal(resolveBatchFilter([lowerNumber, higherNumber], undefined).batchId, higherNumber.batch_id, "número maior desempata datas");
const firstId = batch("batch-a", 9, "ABERTO", "2026-10-01");
const lastId = batch("batch-z", 9, "ABERTO", "2026-10-01");
assert.equal(resolveBatchFilter([lastId, firstId], undefined).batchId, firstId.batch_id, "id desempata de modo determinístico");
assert.equal(resolveBatchFilter([firstId, lastId], undefined).batchId, firstId.batch_id, "desempate independe da ordem recebida");

// Explicit accessible ids remain selected even if older, finalized or cancelled.
for (const selected of [olderOpen, newerFinalized, cancelled]) {
  const filter = resolveBatchFilter(allBatches, selected.batch_id);
  assert.equal(filter.batch, selected, "respeita lote explicitamente escolhido");
  assert.equal(filter.batchId, selected.batch_id);
  assert.equal(filter.value, selected.batch_id);
  assert.equal(filter.shouldCanonicalize, false);
}
assert.equal(formatBatchLabel(newerFinalized), "Lote 021 — Finalizado");
assert.equal(formatBatchLabel(cancelled), "Lote 022 — Cancelado");
assert.equal(formatBatchLabel(batch("large", 1234, "ABERTO", "2026-10-01")), "Lote 1234 — Em andamento");

// Explicit general selections survive refresh even when a default batch is available.
for (const selection of ["todos", ""]) {
  const general = resolveBatchFilter(allBatches, selection);
  assert.deepEqual(general, {
    batch: null,
    batchId: null,
    value: "todos",
    label: "Todos os lotes",
    shouldCanonicalize: false,
  });
  assert.deepEqual(resolveBatchFilter(allBatches, general.value), general, "visão geral permanece ao atualizar");
}

// Unknown and inaccessible ids fall back only to batches in the accessible list.
for (const selection of ["invalid-id", "private-batch"]) {
  assert.deepEqual(resolveBatchFilter(allBatches, selection), defaultFilter, "identificador indisponível aplica e canoniza o padrão");
}
assert.equal(resolveBatchFilter([cancelled], "invalid-id").value, "todos", "identificador inválido sem lote elegível cai na visão geral");
assert.equal(resolveBatchFilter([newerFinalized], "private-batch").batchId, newerFinalized.batch_id, "fallback finalizado respeita a lista acessível");

const currentParams = {
  cliente: "cliente com espaço & acento",
  produto: "produto/1",
  periodo: "mes",
  inicio: "2026-10-01",
  fim: "2026-10-31",
  lote: newerOpen.batch_id,
  ausente: undefined,
};
const paramsSnapshot = { ...currentParams };
const batchUrl = new URL(buildFilterUrl("/consultas", currentParams, { lote: olderOpen.batch_id }), "https://example.test");
assert.equal(batchUrl.pathname, "/consultas");
assert.deepEqual(Object.fromEntries(batchUrl.searchParams), {
  cliente: currentParams.cliente,
  produto: currentParams.produto,
  periodo: currentParams.periodo,
  inicio: currentParams.inicio,
  fim: currentParams.fim,
  lote: olderOpen.batch_id,
}, "trocar lote preserva cliente, produto e período e codifica caracteres especiais");

const periodUrl = new URL(buildFilterUrl("/consultas", currentParams, {
  periodo: "semana",
  inicio: undefined,
  fim: undefined,
}), "https://example.test");
assert.deepEqual(Object.fromEntries(periodUrl.searchParams), {
  cliente: currentParams.cliente,
  produto: currentParams.produto,
  periodo: "semana",
  lote: newerOpen.batch_id,
}, "trocar período preserva lote, cliente e produto e remove somente as datas substituídas");
const generalUrl = new URL(buildFilterUrl("/consultas", currentParams, { lote: "todos" }), "https://example.test");
assert.equal(resolveBatchFilter(allBatches, generalUrl.searchParams.get("lote") ?? undefined).batchId, null, "link da visão geral continua explícito");
assert.deepEqual(currentParams, paramsSnapshot, "montar URL não modifica parâmetros recebidos");
assert.equal(buildFilterUrl("/dashboard", {}), "/dashboard", "sem parâmetros não há interrogação");
assert.equal(buildFilterUrl("/dashboard", { lote: "todos" }, { lote: undefined }), "/dashboard", "remover último parâmetro remove interrogação");
assert.equal(buildFilterUrl("/dashboard", { lote: "" }), "/dashboard?lote=", "valor vazio explícito é preservado");

console.log("check-batch-filters: ok");
