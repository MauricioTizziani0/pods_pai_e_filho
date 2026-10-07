"use server";

import { getSessionState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, isMissingSchema } from "@/lib/errors";
import { revalidateCommerce } from "@/lib/revalidate";
import { buildWhatsAppPromotion, validatePromotionSettings } from "@/lib/domain/promotion";
import type { PromotionMessageResult, PromotionSettings, PromotionSnapshot } from "@/lib/domain/promotion";
import type { ActionResult } from "@/lib/types";

const MIGRATION_MESSAGE = "Execute a migration supabase/migrations/20261002120000_006_whatsapp_promotion.sql no SQL Editor do Supabase para habilitar a divulgação.";

async function adminClient() {
  const session = await getSessionState();
  if (session.status !== "ok" || session.profile.role_code.toLowerCase() !== "admin") {
    return { error: "A divulgação está disponível apenas para o Administrador.", supabase: null };
  }
  return { error: null, supabase: await createClient() };
}

export async function generateWhatsAppMessageAction(): Promise<PromotionMessageResult> {
  const access = await adminClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  // One database snapshot reads balances, Normal prices and settings together.
  const { data, error } = await access.supabase.rpc("get_whatsapp_promotion_snapshot");
  if (error) return { ok: false, message: isMissingSchema(error) ? MIGRATION_MESSAGE : dbErrorMessage(error) };
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.warnings)) {
    return { ok: false, message: "Não foi possível consultar o estoque atual para divulgação. Tente novamente." };
  }
  try {
    return buildWhatsAppPromotion(data as PromotionSnapshot);
  } catch {
    return { ok: false, message: "Revise as informações para divulgação dos produtos e tente novamente." };
  }
}

export async function savePromotionSettingsAction(input: PromotionSettings): Promise<ActionResult> {
  const access = await adminClient();
  if (access.error || !access.supabase) return { ok: false, message: access.error ?? "Sem permissão." };
  const validation = validatePromotionSettings(input);
  if (!validation.ok) return validation;
  const { error } = await access.supabase.rpc("save_whatsapp_promotion_settings", {
    p_header: validation.settings.header,
    p_footer: validation.settings.footer,
  });
  if (error) return { ok: false, message: isMissingSchema(error) ? MIGRATION_MESSAGE : dbErrorMessage(error) };
  revalidateCommerce();
  return { ok: true };
}
