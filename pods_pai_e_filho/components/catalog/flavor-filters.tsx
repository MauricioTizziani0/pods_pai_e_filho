import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function IceFilterSelect({
  defaultValue,
  name = "ice",
  className,
}: {
  defaultValue?: string;
  name?: string;
  className?: string;
}) {
  return (
    <select className={cn(controlClass, "h-11 w-full min-w-0", className)} name={name} defaultValue={defaultValue ?? ""} aria-label="Filtro Ice">
      <option value="">Ice: todos</option>
      <option value="sim">Ice</option>
      <option value="nao">Não Ice</option>
    </select>
  );
}
