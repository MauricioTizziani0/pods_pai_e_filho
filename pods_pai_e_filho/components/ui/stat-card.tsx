import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { AnimatedValue } from "@/components/ui/animated-value";
import { cn } from "@/lib/utils";

type Tone = "default" | "primary" | "success" | "warning" | "info";

const toneIcon: Record<Tone, string> = {
  default: "border-border bg-surface-2 text-muted-foreground",
  primary: "border-primary/40 bg-primary/15 text-primary",
  success: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  info: "border-info/35 bg-info/10 text-info",
};

const toneValue: Record<Tone, string> = {
  default: "text-foreground",
  primary: "text-primary glow-text",
  success: "text-success",
  warning: "text-warning",
  info: "text-foreground",
};

export function StatCard({
  label,
  value,
  kind = "brl",
  suffix,
  hint,
  icon: Icon,
  tone = "default",
  featured,
  accent,
  href,
  className,
}: {
  label: string;
  value: number;
  kind?: "brl" | "int";
  suffix?: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Card de maior destaque (borda e brilho vermelho, cantos HUD). */
  featured?: boolean;
  /** Linha superior vermelha. */
  accent?: boolean;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="eyebrow min-w-0 break-words">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
              toneIcon[featured ? "primary" : tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 min-w-0 break-words font-display text-xl font-bold leading-tight tracking-tight tabular-nums sm:text-2xl sm:leading-none md:text-[1.75rem]",
          toneValue[featured ? "primary" : tone],
        )}
      >
        <AnimatedValue value={value} kind={kind} />
        {suffix ? <span className="ml-1 text-base font-semibold text-muted-foreground">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-2 min-w-0 break-words text-xs text-muted-foreground">{hint}</p> : null}
      {href ? (
        <ArrowUpRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
      ) : null}
    </>
  );

  const classes = cn(
    "tech-card group relative w-full min-w-0 max-w-full p-4 transition-[border-color,box-shadow,transform] duration-200",
    accent && "tech-card-accent",
    featured && "tech-card-glow hud-corners",
    href && "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow-sm",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return <article className={classes}>{body}</article>;
}
