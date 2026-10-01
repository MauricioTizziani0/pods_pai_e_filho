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
  if (isMissingSchema(error)) {
    return "O banco ainda não foi preparado. Execute a migration do Supabase descrita no README.";
  }
  return error.message.replace(/^.*ERROR:\s*/i, "").replace(/^P\d+:\s*/, "");
}
