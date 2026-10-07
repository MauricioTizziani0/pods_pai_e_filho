import { LogoutButton } from "@/components/logout-button";
import { SystemScreen } from "@/components/setup/system-screen";

export function SchemaMissing({ message }: { message: string }) {
  return (
    <SystemScreen eyebrow="Configuração" title="Banco ainda não está pronto">
      <p>{message}</p>
      <ol className="grid gap-2 pl-5 text-foreground/90 [counter-reset:step] [&>li]:list-decimal">
        <li>Abra o SQL Editor do seu projeto no Supabase.</li>
        <li>
          Cole o arquivo{" "}
          <code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261001140000_001_pods_init.sql
          </code>
          .
        </li>
        <li>Execute o script uma vez e volte a entrar.</li>
      </ol>
      <div className="pt-2">
        <LogoutButton />
      </div>
    </SystemScreen>
  );
}
