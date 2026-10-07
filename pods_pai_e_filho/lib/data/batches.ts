import { createClient } from "@/lib/supabase/server";
import type { BatchItemOverview, BatchOverview } from "@/lib/types";

export async function listBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("batch_overview")
    .select("*")
    .order("batch_number", { ascending: false });
  if (error) return { ok: false as const, message: error.message, batches: [] as BatchOverview[] };
  return { ok: true as const, message: "", batches: (data ?? []) as BatchOverview[] };
}

export async function getBatchDetails(id: string) {
  const supabase = await createClient();
  const [batch, items] = await Promise.all([
    supabase.from("batch_overview").select("*").eq("batch_id", id).maybeSingle(),
    supabase.from("batch_item_overview").select("*").eq("batch_id", id).order("product_name").order("variant_name"),
  ]);
  if (batch.error) return { ok: false as const, message: batch.error.message };
  if (items.error) return { ok: false as const, message: items.error.message };
  if (!batch.data) return { ok: false as const, message: "Lote não encontrado." };
  return {
    ok: true as const,
    batch: batch.data as BatchOverview,
    items: (items.data ?? []) as BatchItemOverview[],
  };
}
