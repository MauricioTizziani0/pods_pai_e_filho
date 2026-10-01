"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PainelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="tech-card tech-card-accent hud-corners animate-enter p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Erro</p>
          <h1 className="mt-1 font-display text-2xl font-bold">Algo saiu do esperado</h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{error.message}</p>
          {error.digest ? (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">ref {error.digest}</p>
          ) : null}
          <Button type="button" onClick={reset} className="mt-4">
            <RotateCcw />
            Tentar de novo
          </Button>
        </div>
      </div>
    </div>
  );
}
