import "server-only";

import { getSessionState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, isMissingSchema } from "@/lib/errors";
import { validatePromotionSettings } from "@/lib/domain/promotion";
import type { PromotionSettings } from "@/lib/domain/promotion";

export async function loadPromotionSettings(): Promise<
  { ok: true; settings: PromotionSettings } | { ok: false; message: string }
> {
  const session = await getSessionState();
  if (session.status !== "ok" || session.profile.role_code.toLowerCase() !== "admin") {
    return { ok: false, message: "A divulgação está disponível apenas para o Administrador." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "whatsapp_promotion")
    .maybeSingle();
  if ((error && isMissingSchema(error)) || (!error && data?.value == null)) {
    return { ok: false, message: "Execute a migration supabase/migrations/20261002120000_whatsapp_promotion.sql no SQL Editor do Supabase para habilitar a divulgação." };
  }
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return validatePromotionSettings(data?.value);
}
