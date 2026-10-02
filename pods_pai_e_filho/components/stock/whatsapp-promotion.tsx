"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Copy, Loader2, Share2, Smartphone, X } from "lucide-react";
import { generateWhatsAppMessageAction } from "@/lib/actions/promotion";
import { EMPTY_PROMOTION_MESSAGE, getWhatsAppUrl } from "@/lib/domain/promotion";
import { Notice } from "@/components/feedback/notice";
import { Button } from "@/components/ui/button";

export function WhatsAppPromotion() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function generate() {
    setMessage(null);
    setWarnings([]);
    setError(null);
    setFeedback(null);
    setOpen(true);
    startTransition(async () => {
      try {
        const result = await generateWhatsAppMessageAction();
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setMessage(result.message);
        setWarnings(result.warnings);
      } catch {
        setError("Não foi possível consultar o estoque. Verifique sua conexão e tente novamente.");
      }
    });
  }

  async function copy() {
    if (!message) return;
    setError(null);
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(message);
    } catch {
      // Older browsers can still copy from a selected field inside the modal.
      const field = document.createElement("textarea");
      field.value = message;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      field.style.width = "1px";
      field.style.height = "1px";
      const previousFocus = document.activeElement;
      try {
        dialogRef.current?.appendChild(field);
        field.select();
        field.setSelectionRange(0, message.length);
        if (!document.execCommand("copy")) throw new Error("copy failed");
      } catch {
        setError("Não foi possível copiar. Selecione o texto da prévia e copie manualmente.");
        return;
      } finally {
        field.remove();
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
      }
    }
    setFeedback("Mensagem copiada!");
  }

  async function share() {
    if (!message || !navigator.share) return;
    setError(null);
    setFeedback(null);
    setSharing(true);
    try {
      await navigator.share({ text: message });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) {
        setError("Não foi possível compartilhar. Você pode copiar a mensagem ou abrir o WhatsApp.");
      }
    } finally {
      setSharing(false);
    }
  }

  const disabled = pending || !message;

  return (
    <div className="w-full min-w-0">
      <Button
        type="button"
        onClick={generate}
        disabled={pending}
        className="h-auto min-h-11 w-full whitespace-normal px-3 py-3 sm:w-auto"
      >
        <Smartphone aria-hidden />
        Gerar mensagem para WhatsApp
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/80"
      >
        <div className="flex max-h-[calc(100dvh-1.5rem)] min-w-0 flex-col [@media(max-height:480px)]:max-h-none">
          <div className="flex shrink-0 items-start gap-3 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="break-words text-lg font-semibold">Pré-visualização da mensagem</h2>
              <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                Revise antes de abrir o WhatsApp. O envio é confirmado por você no aplicativo.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Fechar pré-visualização" onClick={() => setOpen(false)}>
              <X aria-hidden />
            </Button>
          </div>

          <div className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-y-auto p-4" aria-busy={pending}>
            {pending ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Consultando o estoque atual…
              </p>
            ) : message ? (
              <pre tabIndex={0} aria-label="Mensagem para divulgação" className="min-w-0 whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 font-sans text-sm leading-relaxed [overflow-wrap:anywhere]">
                {message}
              </pre>
            ) : !error ? (
              <Notice tone="info">{EMPTY_PROMOTION_MESSAGE}</Notice>
            ) : null}
            {warnings.map((warning, index) => <Notice key={index} tone="info">{warning}</Notice>)}
            {feedback ? <Notice tone="success">{feedback}</Notice> : null}
            {error ? <Notice>{error}</Notice> : null}
          </div>

          <div className="grid shrink-0 gap-2 border-t border-border p-4 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={copy} disabled={disabled} className="h-auto min-h-11 w-full whitespace-normal py-2">
              <Copy aria-hidden /> Copiar mensagem
            </Button>
            <Button
              type="button"
              disabled={disabled}
              className="h-auto min-h-11 w-full whitespace-normal py-2"
              onClick={() => { if (message) window.location.assign(getWhatsAppUrl(message)); }}
            >
              <Smartphone aria-hidden /> Enviar pelo WhatsApp
            </Button>
            {canShare ? (
              <Button type="button" variant="secondary" onClick={share} disabled={disabled || sharing} className="h-auto min-h-11 w-full whitespace-normal py-2 sm:col-span-2">
                <Share2 aria-hidden /> Compartilhar
              </Button>
            ) : null}
            <Button type="button" variant="ghost" disabled={pending} onClick={generate} className="h-auto min-h-11 w-full whitespace-normal py-2 sm:col-span-2">
              Atualizar com o estoque atual
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
