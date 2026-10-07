import type { BatchOverview } from "../types.ts";

export type BatchFilter = {
  batch: BatchOverview | null;
  batchId: string | null;
  value: string;
  label: string;
  shouldCanonicalize: boolean;
};

const statusLabels: Record<BatchOverview["status"], string> = {
  ABERTO: "Em andamento",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export function formatBatchLabel(batch: BatchOverview) {
  return `Lote ${String(batch.batch_number).padStart(3, "0")} — ${statusLabels[batch.status]}`;
}

function compareNewestBatch(left: BatchOverview, right: BatchOverview) {
  const purchaseDate = right.purchase_date.localeCompare(left.purchase_date);
  if (purchaseDate) return purchaseDate;

  const createdAt = Date.parse(right.created_at) - Date.parse(left.created_at);
  if (createdAt) return createdAt;

  const batchNumber = right.batch_number - left.batch_number;
  if (batchNumber) return batchNumber;

  return left.batch_id < right.batch_id ? -1 : left.batch_id > right.batch_id ? 1 : 0;
}

export function resolveBatchFilter(
  batches: BatchOverview[],
  selection: string | undefined,
): BatchFilter {
  if (selection === "todos" || selection === "") {
    return {
      batch: null,
      batchId: null,
      value: "todos",
      label: "Todos os lotes",
      shouldCanonicalize: false,
    };
  }

  const selectedBatch = selection === undefined
    ? undefined
    : batches.find((batch) => batch.batch_id === selection);
  const batch = selectedBatch
    ?? batches.filter((item) => item.status === "ABERTO").sort(compareNewestBatch)[0]
    ?? batches.filter((item) => item.status === "FINALIZADO").sort(compareNewestBatch)[0]
    ?? null;

  return {
    batch,
    batchId: batch?.batch_id ?? null,
    value: batch?.batch_id ?? "todos",
    label: batch ? formatBatchLabel(batch) : "Todos os lotes",
    shouldCanonicalize: selectedBatch === undefined,
  };
}

export function buildFilterUrl(
  path: string,
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined> = {},
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, value);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) searchParams.delete(key);
    else searchParams.set(key, value);
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}
