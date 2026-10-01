import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { SystemScreen } from "@/components/setup/system-screen";

export default async function Home() {
  if (!hasEnvVars) {
    return (
      <SystemScreen eyebrow="Configuração" title="Falta a conexão com o Supabase">
        <p>
          Copie .env.example para .env.local e preencha a URL e a chave pública do projeto. Não use a service role no
          navegador.
        </p>
      </SystemScreen>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/inicio" : "/auth/login");
}
