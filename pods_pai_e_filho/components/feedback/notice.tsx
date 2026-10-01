import { cn } from "@/lib/utils";

export function Notice({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-3 py-2 text-sm",
        tone === "error" && "bg-red-50 text-red-800",
        tone === "success" && "bg-emerald-50 text-emerald-900",
        tone === "info" && "bg-amber-50 text-amber-950",
      )}
    >
      {children}
    </p>
  );
}
