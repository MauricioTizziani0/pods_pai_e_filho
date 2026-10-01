import { BrandHero } from "@/components/brand/logo";

/**
 * Moldura das telas de autenticação: logo em destaque, painel escuro com
 * detalhes HUD e brilho vermelho discreto. Só apresentação.
 */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh w-full min-w-0 max-w-full items-center justify-center overflow-hidden p-4 sm:p-6 md:p-10">
      {/* linhas geométricas de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="animate-enter relative w-full min-w-0 max-w-sm">
        <BrandHero className="mb-6 max-w-[14rem]" />
        <div className="tech-card tech-card-accent hud-corners p-6">
          <div className="mb-5">
            <p className="brand-rules eyebrow w-full justify-center text-primary">Pods · Pai e Filho</p>
            <h1 className="mt-1 font-display text-2xl font-bold">{title}</h1>
            {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
