import { Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getFlavorDisplayName } from "@/lib/domain/flavors";
import { cn } from "@/lib/utils";

export function PaymentBadge({
  name,
  received,
  cancelled,
}: {
  name: string;
  received: boolean;
  cancelled?: boolean;
}) {
  if (cancelled) return <Badge variant="neutral">Cancelada</Badge>;
  if (received) return <Badge variant="success" dot>{name}</Badge>;
  return <Badge variant="warning" dot>{name}</Badge>;
}

export function CreditBadge() {
  return <Badge variant="danger">Fiado</Badge>;
}

export function TransferBadge({
  paid,
  dueNow,
  future,
  cancelled,
}: {
  paid: boolean;
  dueNow: boolean;
  future: boolean;
  cancelled?: boolean;
}) {
  if (cancelled) return <Badge variant="neutral">Sem efeito</Badge>;
  if (paid) return <Badge variant="success">Repassado</Badge>;
  if (dueNow) return <Badge variant="danger" dot>A enviar agora</Badge>;
  if (future) return <Badge variant="info">Repasse futuro</Badge>;
  return <Badge variant="neutral">Repasse</Badge>;
}

export function StockBadge({ quantity, threshold }: { quantity: number; threshold: number }) {
  if (quantity <= 0) return <Badge variant="danger">Sem estoque</Badge>;
  if (quantity <= threshold) return <Badge variant="warning" dot>Estoque baixo</Badge>;
  return <Badge variant="success">Em estoque</Badge>;
}

export function IceBadge({ className }: { className?: string }) {
  return (
    <Badge variant="info" className={cn("gap-1", className)} title="Sabor Ice">
      <Snowflake className="h-3 w-3" aria-hidden />
      Ice
    </Badge>
  );
}

export function FlavorLabel({
  name,
  isIce,
  mode = "list",
  className,
}: {
  name: string;
  isIce?: boolean | null;
  mode?: "list" | "display";
  className?: string;
}) {
  const ice = Boolean(isIce);
  if (mode === "display") {
    return <span className={className}>{getFlavorDisplayName({ name, is_ice: ice })}</span>;
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span className="truncate">{name}</span>
      {ice ? <IceBadge /> : null}
    </span>
  );
}
