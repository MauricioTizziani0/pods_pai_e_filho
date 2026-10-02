/* A logo oficial é servida como está, sem o otimizador do Next. */
/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/logo.png";

/**
 * Placa da logo oficial. A arte tem fundo branco e wordmark preto,
 * então ela sempre aparece sobre uma placa clara — a interface escura
 * é construída ao redor dela, sem alterar a logo.
 */
export function BrandPlate({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_0_18px_-6px_hsl(var(--primary)/0.55)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* img nativo: a logo oficial não passa pelo otimizador do Next. */}
      <img src={LOGO_SRC} alt="Pods - Pai e Filho" width={size} height={size} className="h-full w-full object-contain" />
    </span>
  );
}

/** Marca compacta: placa + nome. Usada no cabeçalho mobile. */
export function BrandMark({
  size = 44,
  className,
  compact,
}: {
  size?: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <BrandPlate size={size} />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-xl font-bold tracking-tight text-foreground">PODS</span>
          <span className="brand-rules mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            Pai e Filho
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Logo oficial completa, para a sidebar desktop. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative mx-auto block w-[8.75rem] overflow-hidden rounded-md bg-white p-1.5 shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_0_22px_-8px_hsl(var(--primary)/0.55)]",
        className,
      )}
    >
      <img src={LOGO_SRC} alt="Pods - Pai e Filho" width={512} height={512} className="h-auto w-full object-contain" />
    </span>
  );
}

/** Logo completa em destaque (login e telas de sistema). */
export function BrandHero({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[15rem]", className)}>
      <div aria-hidden className="absolute -inset-8 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-lg bg-white p-2 shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_0_48px_-12px_hsl(var(--primary)/0.65)]">
        <img src={LOGO_SRC} alt="Pods - Pai e Filho" width={512} height={512} className="h-auto w-full object-contain" />
      </div>
    </div>
  );
}
