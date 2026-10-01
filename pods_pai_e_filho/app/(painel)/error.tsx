"use client";

export default function PainelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h1 className="font-display text-3xl">Algo saiu do esperado</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Tentar de novo
      </button>
    </div>
  );
}
