import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Classe compartilhada por inputs, selects e textareas nativos (filtros, formulários). */
const controlClass =
  "flex h-12 w-full rounded-md border border-input bg-surface px-3 text-base text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.02)] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/80 hover:bg-surface-2 focus-visible:border-primary focus-visible:shadow-glow-sm focus-visible:ring-1 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "appearance-none pr-10", className)} {...props} />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlClass, "h-auto min-h-24 resize-y py-3", className)}
      {...props}
    />
  );
}

export { controlClass };
