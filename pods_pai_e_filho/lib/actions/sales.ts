"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { revalidateCommerce } from "@/lib/revalidate";
import type { ActionResult } from "@/lib/types";

async function writerClient() {
  const session = await getSessionState();
  if (session.status !== "ok") {
    return { error: "Sessão inválida. Entre novamente.", supabase: null };
  }
  if (!session.profile.can_write) {
    return { error: "Seu perfil só permite consulta.", supabase: null };
  }
  return { error: null, supabase: await createClient() };
}

export async function createSaleAction(input: {
  saleDate: string;
  customerId: string;
  customerName: string;
  customerTypeId: string;
  paymentStatusId: string;
  isCredit: boolean;
  notes: string;
  variantId: string;
  quantity: number;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };

  const name = input.customerName.trim();
  if (!name) return { ok: false, message: "Informe o nome do cliente." };
  if (!input.variantId || !input.customerTypeId || !input.paymentStatusId) {
    return { ok: false, message: "Preencha produto, sabor, tipo e pagamento." };
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: "Informe uma quantidade válida." };
  }

  const { data, error } = await access.supabase.rpc("create_sale", {
    payload: {
      sale_date: input.saleDate,
      customer_id: input.customerId || null,
      customer_name: name,
      customer_type_id: input.customerTypeId,
      payment_status_id: input.paymentStatusId,
      is_credit: input.isCredit,
      notes: input.notes.trim() || null,
      items: [{ variant_id: input.variantId, quantity: input.quantity }],
    },
  });

  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data as string };
}

export async function updateSaleAction(input: {
  saleId: string;
  saleDate: string;
  customerId: string;
  customerName: string;
  customerTypeId: string;
  paymentStatusId: string;
  isCredit: boolean;
  notes: string;
  variantId: string;
  quantity: number;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (!input.customerName.trim()) return { ok: false, message: "Informe o nome do cliente." };
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: "Informe uma quantidade válida." };
  }

  const { error } = await access.supabase.rpc("update_sale", {
    p_sale_id: input.saleId,
    payload: {
      sale_date: input.saleDate,
      customer_id: input.customerId || null,
      customer_name: input.customerName.trim(),
      customer_type_id: input.customerTypeId,
      payment_status_id: input.paymentStatusId,
      is_credit: input.isCredit,
      notes: input.notes.trim() || null,
      variant_id: input.variantId,
      quantity: input.quantity,
    },
  });

  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: input.saleId };
}

export async function confirmReceiptAction(saleId: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const { error } = await access.supabase.rpc("confirm_receipt", { p_sale_id: saleId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: saleId };
}

export async function cancelSaleAction(saleId: string, reason: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const { error } = await access.supabase.rpc("cancel_sale", {
    p_sale_id: saleId,
    p_reason: reason.trim() || null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: saleId };
}

export async function confirmTransfersAction(saleIds: string[], notes: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (saleIds.length === 0) return { ok: false, message: "Selecione ao menos uma venda." };
  const { data, error } = await access.supabase.rpc("confirm_transfers", {
    p_sale_ids: saleIds,
    p_notes: notes.trim() || null,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data as string };
}
