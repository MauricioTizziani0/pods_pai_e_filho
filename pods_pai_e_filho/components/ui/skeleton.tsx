import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-[linear-gradient(90deg,hsl(var(--surface))_0%,hsl(var(--surface-2))_50%,hsl(var(--surface))_100%)] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    />
  );
}
