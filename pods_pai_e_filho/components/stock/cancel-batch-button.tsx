"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { cancelPurchaseBatchAction } from "@/lib/actions/stock";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/feedback/notice";

export function CancelBatchButton({ batchId, isLegacy }: { batchId: string; isLegacy: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    const effect = isLegacy
      ? "O saldo continuará no estoque geral, sem lote conhecido."
      : "As unidades desta compra serão removidas do estoque.";
    const question = isLegacy ? "Desfazer esta associação?" : "Cancelar esta compra?";
    if (!window.confirm(`${question} ${effect} A ação só será concluída se nenhuma unidade tiver sido vendida e o saldo estiver intacto.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelPurchaseBatchAction(batchId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid justify-items-end gap-2">
      <Button type="button" variant="destructive" disabled={pending} onClick={cancel}>
        <XCircle className="h-4 w-4" /> {pending ? "Processando..." : isLegacy ? "Desfazer associação" : "Cancelar compra"}
      </Button>
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
