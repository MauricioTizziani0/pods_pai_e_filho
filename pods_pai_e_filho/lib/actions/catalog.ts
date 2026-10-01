"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { parseMoney, slugCode } from "@/lib/format";
import { revalidateCommerce } from "@/lib/revalidate";
import type { ActionResult } from "@/lib/types";

async function writerClient() {
  const session = await getSessionState();
  if (session.status !== "ok" || !session.profile.can_write) {
    return { error: "Seu perfil só permite consulta.", supabase: null };
  }
  return { error: null, supabase: await createClient() };
}

export async function saveProductAction(input: {
  id?: string;
  name: string;
  brand: string;
  model: string;
  approximatePuffs: string;
  active: boolean;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Informe o nome do produto." };

  const puffs = input.approximatePuffs.trim() ? Number(input.approximatePuffs) : null;
  if (puffs != null && (!Number.isInteger(puffs) || puffs < 0)) {
    return { ok: false, message: "Quantidade de puffs inválida." };
  }

  const payload = {
    name,
    brand: input.brand.trim(),
    model: input.model.trim(),
    approximate_puffs: puffs,
    active: input.active,
  };

  if (input.id) {
    const { data: previous, error: previousError } = await access.supabase
      .from("products").select("name, brand, model, approximate_puffs, active").eq("id", input.id).single();
    if (previousError) return { ok: false, message: dbErrorMessage(previousError) };
  }

  const query = input.id
    ? access.supabase.from("products").update(payload).eq("id", input.id).select("id").single()
    : access.supabase.from("products").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data.id };
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const { error } = await access.supabase.rpc("delete_unused_product", { p_product_id: productId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: productId };
}

export async function deleteVariantAction(variantId: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const { error } = await access.supabase.rpc("delete_unused_variant", { p_variant_id: variantId });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: variantId };
}

export async function saveVariantAction(input: {
  id?: string;
  productId: string;
  name: string;
  active: boolean;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Informe o sabor." };

  const payload = { product_id: input.productId, name, active: input.active };
  const query = input.id
    ? access.supabase.from("product_variants").update(payload).eq("id", input.id).select("id").single()
    : access.supabase.from("product_variants").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Este sabor já existe neste produto." : dbErrorMessage(error),
    };
  }
  revalidateCommerce();
  return { ok: true, id: data.id };
}

export async function savePriceAction(input: {
  productId: string;
  customerTypeId: string;
  salePrice: string;
  fatherTransfer: string;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const salePrice = parseMoney(input.salePrice);
  const fatherTransfer = parseMoney(input.fatherTransfer);
  if (salePrice == null || fatherTransfer == null) {
    return { ok: false, message: "Informe preço e repasse válidos." };
  }
  if (salePrice < fatherTransfer) {
    return { ok: false, message: "O preço de venda não pode ser menor que o repasse ao pai." };
  }

  const { data: existing, error: readError } = await access.supabase
    .from("price_rules")
    .select("id")
    .eq("product_id", input.productId)
    .eq("customer_type_id", input.customerTypeId)
    .eq("active", true)
    .maybeSingle();
  if (readError) return { ok: false, message: dbErrorMessage(readError) };

  const payload = { sale_price: salePrice, father_transfer: fatherTransfer, active: true };
  const query = existing
    ? access.supabase.from("price_rules").update(payload).eq("id", existing.id).select("id").single()
    : access.supabase
        .from("price_rules")
        .insert({ ...payload, product_id: input.productId, customer_type_id: input.customerTypeId })
        .select("id")
        .single();
  const { data, error } = await query;
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data.id };
}

export async function saveCustomerAction(input: {
  id?: string;
  name: string;
  phone: string;
  notes: string;
  customerTypeId: string;
  active: boolean;
}): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Informe o nome do cliente." };

  const payload = {
    name,
    phone: input.phone.trim() || null,
    notes: input.notes.trim() || null,
    customer_type_id: input.customerTypeId || null,
    active: input.active,
  };
  const query = input.id
    ? access.supabase.from("customers").update(payload).eq("id", input.id).select("id").single()
    : access.supabase.from("customers").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: data.id };
}

export async function saveCustomerTypeAction(name: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const label = name.trim();
  const code = slugCode(label);
  if (!label || !code) return { ok: false, message: "Informe o nome do tipo de cliente." };

  const { data: last } = await access.supabase
    .from("customer_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await access.supabase
    .from("customer_types")
    .insert({ code, name: label, sort_order: (last?.sort_order ?? 0) + 1, active: true })
    .select("id")
    .single();
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Já existe um tipo com este nome." : dbErrorMessage(error),
    };
  }
  revalidateCommerce();
  return { ok: true, id: data.id };
}

export async function setUserRoleAction(userId: string, roleCode: string): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (roleCode !== "admin" && roleCode !== "viewer") {
    return { ok: false, message: "Papel inválido." };
  }
  const { error } = await access.supabase.from("profiles").update({ role_code: roleCode }).eq("id", userId);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true, id: userId };
}

export async function setLowStockThresholdAction(value: number): Promise<ActionResult> {
  const access = await writerClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, message: "Informe um limite inteiro." };
  }
  const { error } = await access.supabase
    .from("app_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", "low_stock_threshold");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true };
}
