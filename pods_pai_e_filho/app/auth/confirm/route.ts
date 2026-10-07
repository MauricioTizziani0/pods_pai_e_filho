import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") === "/auth/update-password" ? "/auth/update-password" : "/inicio";
  let destination = `/auth/error?error=${encodeURIComponent("O link de confirmação está incompleto ou é inválido.")}`;

  if (code || (token_hash && type)) {
    try {
      const supabase = await createClient();
      let confirmationError;
      if (code) {
        ({ error: confirmationError } = await supabase.auth.exchangeCodeForSession(code));
      } else if (token_hash && type) {
        ({ error: confirmationError } = await supabase.auth.verifyOtp({ type, token_hash }));
      }
      destination = confirmationError
        ? `/auth/error?error=${encodeURIComponent("Não foi possível confirmar o acesso. O link pode estar inválido ou expirado.")}`
        : next;
    } catch {
      destination = `/auth/error?error=${encodeURIComponent("Não foi possível conectar ao Supabase. Tente novamente em alguns instantes.")}`;
    }
  }

  redirect(destination);
}
