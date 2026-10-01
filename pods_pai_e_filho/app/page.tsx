import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export default async function Home() {
  if (!hasEnvVars) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
        <p className="font-display text-4xl text-primary">Pods</p>
        <h1 className="text-2xl font-semibold">Falta a conexão com o Supabase</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Copie .env.example para .env.local e preencha a URL e a chave pública do projeto. Não use a service role no navegador.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/inicio" : "/auth/login");
}
