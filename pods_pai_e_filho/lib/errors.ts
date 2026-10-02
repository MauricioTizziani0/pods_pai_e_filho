type DbError = { message?: string; code?: string } | null;

export function isMissingSchema(error: DbError) {
  const message = error?.message ?? "";
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("Could not find")
  );
}

export function dbErrorMessage(
  error: DbError,
  fallback = "Não foi possível concluir a operação.",
) {
  if (!error?.message) return fallback;
  if (error.message.includes("is_ice")) {
    return "Execute a migration supabase/migrations/20261001160000_variant_is_ice.sql no SQL Editor do Supabase.";
  }
  if (/promotion_name|promotion_features|display_order|whatsapp_promotion/.test(error.message)) {
    return "Execute a migration supabase/migrations/20261002120000_whatsapp_promotion.sql no SQL Editor do Supabase para habilitar a divulgação.";
  }
  if (isMissingSchema(error)) {
    return "O banco ainda não foi preparado. Execute a migration do Supabase descrita no README.";
  }
  return error.message.replace(/^.*ERROR:\s*/i, "").replace(/^P\d+:\s*/, "");
}
