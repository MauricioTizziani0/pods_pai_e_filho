import { cn } from "@/lib/utils";

function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function PaymentBadge({
  name,
  received,
  cancelled,
}: {
  name: string;
  received: boolean;
  cancelled?: boolean;
}) {
  if (cancelled) return <Pill className="bg-stone-200 text-stone-700">Cancelada</Pill>;
  if (received) return <Pill className="bg-emerald-100 text-emerald-900">{name}</Pill>;
  return <Pill className="bg-amber-100 text-amber-950">{name}</Pill>;
}

export function CreditBadge() {
  return <Pill className="bg-rose-100 text-rose-900">Fiado</Pill>;
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
  if (cancelled) return <Pill className="bg-stone-200 text-stone-700">Sem efeito</Pill>;
  if (paid) return <Pill className="bg-emerald-100 text-emerald-900">Repasse pago</Pill>;
  if (dueNow) return <Pill className="bg-orange-100 text-orange-950">A enviar agora</Pill>;
  if (future) return <Pill className="bg-sky-100 text-sky-950">Repasse futuro</Pill>;
  return <Pill className="bg-stone-100 text-stone-700">Repasse</Pill>;
}
