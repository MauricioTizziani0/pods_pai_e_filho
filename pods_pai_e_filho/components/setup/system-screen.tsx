import { BrandHero } from "@/components/brand/logo";

/** Moldura das telas de sistema (404, banco não pronto, sem env). */
export function SystemScreen({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full min-w-0 max-w-lg flex-col justify-center gap-4 px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
      />
      <div className="animate-enter tech-card tech-card-accent hud-corners p-6">
        <BrandHero className="mb-5 max-w-[10rem]" />
        <p className="brand-rules eyebrow text-primary">{eyebrow}</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{title}</h1>
        <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </main>
  );
}
