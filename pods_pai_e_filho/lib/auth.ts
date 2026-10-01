import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/errors";
import type { Profile } from "@/lib/types";

type RoleEmbed = { name: string; can_write: boolean };

export type SessionState =
  | { status: "unauthenticated" }
  | { status: "missing-schema"; message: string }
  | { status: "missing-profile" }
  | { status: "ok"; profile: Profile };

function readRole(value: RoleEmbed | RoleEmbed[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

export async function getSessionState(): Promise<SessionState> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { status: "unauthenticated" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role_code, roles(name, can_write)")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) {
    return {
      status: "missing-schema",
      message: isMissingSchema(error)
        ? "Execute a migration SQL no Supabase antes de usar o sistema."
        : error.message,
    };
  }

  if (!data) return { status: "missing-profile" };

  const role = readRole(data.roles as RoleEmbed | RoleEmbed[] | null);
  return {
    status: "ok",
    profile: {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      role_code: data.role_code,
      role_name: role?.name ?? data.role_code,
      can_write: Boolean(role?.can_write),
    },
  };
}
