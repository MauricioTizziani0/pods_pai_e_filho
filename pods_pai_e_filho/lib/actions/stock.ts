"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { revalidateCommerce } from "@/lib/revalidate";
import type { ActionResult } from "@/lib/types";

async function writerClient() {
  const session = await getSessionState();
  if (session.status !== "ok" || !session.profile.can_write) {
    return { error: "Seu perfil só permite consulta.", supabase: null };
  }
  return { error: null, supabase: await createClient() };
}

export async function registerStockMovementAction(input: {
  variantId: string;
  type: string;
  quantity: number;
  date: string;
  notes: string;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: "Informe uma quantidade válida." };
  }

  const { data, error } = await access.supabase.rpc("register_stock_movement", {
    p_variant_id: input.variantId,
    p_type: input.type,
    p_quantity: input.quantity,
    p_date: input.date || null,
    p_notes: input.notes.trim() || null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data as string };
}

export async function createPurchaseAction(input: {
  purchaseDate: string;
  notes: string;
  items: { variantId: string; quantity: number; unitCost: number }[];
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (!input.items.length || input.items.some((item) =>
    !item.variantId || !Number.isInteger(item.quantity) || item.quantity <= 0 ||
    !Number.isFinite(item.unitCost) || item.unitCost < 0
  )) {
    return { ok: false, message: "Informe ao menos um item, com quantidade e custo válidos." };
  }

  const { data, error } = await access.supabase.rpc("create_purchase", {
    payload: {
      purchase_date: input.purchaseDate,
      notes: input.notes.trim() || null,
      items: input.items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
    },
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data as string };
}

export async function createLegacyBatchAction(input: {
  notes: string;
  items: { variantId: string; quantity: number; unitCost: number }[];
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (!input.items.length || input.items.some((item) =>
    !item.variantId || !Number.isInteger(item.quantity) || item.quantity <= 0 ||
    !Number.isFinite(item.unitCost) || item.unitCost < 0
  )) {
    return { ok: false, message: "Informe quantidade e custo histórico conhecido para cada sabor." };
  }
  const { data, error } = await access.supabase.rpc("create_legacy_batch", {
    payload: {
      notes: input.notes.trim() || null,
      items: input.items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_cost: item.unitCost,
      })),
    },
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data as string };
}

export async function cancelPurchaseBatchAction(batchId: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const { error } = await access.supabase.rpc("cancel_purchase_batch", { p_batch_id: batchId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: batchId };
}

export async function registerStockCountAction(input: {
  notes: string;
  lines: { variantId: string; physicalQuantity: number }[];
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (input.lines.some((line) => !Number.isInteger(line.physicalQuantity) || line.physicalQuantity < 0)) {
    return { ok: false, message: "Informe quantidades físicas válidas." };
  }

  const { data, error } = await access.supabase.rpc("register_stock_count", {
    payload: {
      notes: input.notes.trim() || null,
      lines: input.lines.map((line) => ({
        variant_id: line.variantId,
        physical_quantity: line.physicalQuantity,
      })),
    },
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data as string };
}

export async function applyStockCountAction(countId: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const { error } = await access.supabase.rpc("apply_stock_count", { p_count_id: countId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: countId };
}
