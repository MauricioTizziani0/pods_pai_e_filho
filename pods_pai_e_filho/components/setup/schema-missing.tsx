import { LogoutButton } from "@/components/logout-button";

export function SchemaMissing({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-6">
      <p className="font-display text-3xl text-primary">Pods</p>
      <h1 className="text-2xl font-semibold">Banco ainda não está pronto</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        <li>Abra o SQL Editor do seu projeto no Supabase.</li>
        <li>Cole o arquivo supabase/migrations/20261001140000_pods_init.sql.</li>
        <li>Execute o script uma vez e volte a entrar.</li>
      </ol>
      <LogoutButton />
    </main>
  );
}
