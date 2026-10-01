import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Seção com cabeçalho padronizado (título em Space Grotesk, descrição, ação à direita).
 * Substitui os antigos blocos "rounded-2xl border bg-card p-4".
 */
export function Panel({
  title,
  description,
  icon: Icon,
  action,
  accent,
  glow,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  accent?: boolean;
  glow?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("tech-card", accent && "tech-card-accent", glow && "tech-card-glow", className)}
    >
      {title || action ? (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 className="truncate font-display text-base font-semibold leading-tight md:text-lg">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{description}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
