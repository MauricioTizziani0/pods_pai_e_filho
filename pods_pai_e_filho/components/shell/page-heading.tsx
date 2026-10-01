import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeading({
  title,
  description,
  eyebrow,
  action,
  back,
  children,
}: {
  title: string;
  description?: string;
  /** Pequena etiqueta acima do título (ex.: período, código). */
  eyebrow?: string;
  action?: { href: string; label: string; icon?: "plus" };
  back?: { href: string; label: string };
  /** Conteúdo extra à direita (filtros, botões adicionais). */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 grid gap-3">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="brand-rules eyebrow mb-1.5 text-primary">{eyebrow}</p> : null}
          <h1 className="relative font-display text-2xl font-bold leading-none tracking-tight md:text-3xl">
            <span aria-hidden className="absolute -left-3 top-1 hidden h-[0.9em] w-[3px] rounded-full bg-primary shadow-glow-sm md:block" />
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {action ? (
            <Link href={action.href} className={cn(buttonVariants({ size: "default" }), "press")}>
              {action.icon === "plus" ? <Plus /> : null}
              {action.label}
            </Link>
          ) : null}
        </div>
      </div>
      <hr className="divider-glow opacity-60" />
    </div>
  );
}
