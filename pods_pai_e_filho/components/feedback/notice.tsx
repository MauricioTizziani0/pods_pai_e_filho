import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function Notice({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "animate-enter flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm leading-relaxed",
        tone === "error" && "border-primary/40 bg-primary/10 text-foreground",
        tone === "success" && "border-success/35 bg-success/10 text-foreground",
        tone === "info" && "border-warning/35 bg-warning/10 text-foreground",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "error" && "text-primary",
          tone === "success" && "text-success",
          tone === "info" && "text-warning",
        )}
      />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
