"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { savePromotionSettingsAction } from "@/lib/actions/promotion";
import { PROMOTION_HEADER_MAX_LENGTH, PROMOTION_FOOTER_MAX_LENGTH, type PromotionSettings } from "@/lib/domain/promotion";
import { Notice } from "@/components/feedback/notice";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";

export function PromotionSettingsPanel({ settings }: { settings: PromotionSettings }) {
  const router = useRouter();
  const id = useId();
  const [header, setHeader] = useState(settings.header);
  const [footer, setFooter] = useState(settings.footer);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Panel title="Divulgação" description="Textos usados na mensagem de WhatsApp gerada em Estoque" icon={Smartphone}>
      <form
        className="grid min-w-0 gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setSuccess(false);
          startTransition(async () => {
            try {
              const result = await savePromotionSettingsAction({ header, footer });
              if (!result.ok) { setError(result.message); return; }
              setSuccess(true);
              router.refresh();
            } catch {
              setError("Não foi possível salvar. Verifique sua conexão e tente novamente.");
            }
          });
        }}
      >
        <Field label="Cabeçalho" htmlFor={`${id}-header`} hint="Texto puro, com emojis e quebras de linha.">
          <TextArea id={`${id}-header`} value={header} onChange={(event) => { setHeader(event.target.value); setSuccess(false); }} maxLength={PROMOTION_HEADER_MAX_LENGTH} rows={2} required disabled={pending} aria-label="Cabeçalho da mensagem" />
        </Field>
        <Field label="Rodapé da mensagem" htmlFor={`${id}-footer`} hint="Pode ficar vazio. Ajuste aqui as informações de entrega e pronta entrega.">
          <TextArea id={`${id}-footer`} value={footer} onChange={(event) => { setFooter(event.target.value); setSuccess(false); }} maxLength={PROMOTION_FOOTER_MAX_LENGTH} rows={3} disabled={pending} aria-label="Rodapé da mensagem" />
        </Field>
        <p className="text-sm text-muted-foreground">O nome para divulgação, os puffs, as características e a ordem de cada produto são definidos em Produtos.</p>
        {success ? <Notice tone="success">Configurações de divulgação salvas.</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        <Button type="submit" disabled={pending} className="h-auto min-h-11 w-full whitespace-normal py-2 sm:w-fit">
          {pending ? "Salvando…" : "Salvar divulgação"}
        </Button>
      </form>
    </Panel>
  );
}
