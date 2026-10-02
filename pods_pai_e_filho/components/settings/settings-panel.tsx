"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, PackageSearch, Plus, ShieldCheck, Tags, Users } from "lucide-react";
import {
  saveCustomerTypeAction,
  setLowStockThresholdAction,
  setUserRoleAction,
} from "@/lib/actions/catalog";
import type { CustomerType, PaymentStatus, Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SettingsPanel({
  profile,
  profiles,
  types,
  statuses,
  threshold,
}: {
  profile: Profile;
  profiles: Profile[];
  types: CustomerType[];
  statuses: PaymentStatus[];
  threshold: number;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(String(threshold));
  const [typeName, setTypeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Não foi possível salvar.");
        return;
      }
      setMessage(success);
      router.refresh();
    });
  }

  return (
    <div className="stagger grid w-full min-w-0 gap-5">
      <Panel title="Seu acesso" icon={ShieldCheck} accent>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 font-display text-sm font-bold text-primary">
            {initials(profile.full_name)}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {profile.full_name}
              <Badge variant={profile.can_write ? "default" : "neutral"}>{profile.role_name}</Badge>
            </p>
            {profile.email ? <p className="truncate text-sm text-muted-foreground">{profile.email}</p> : null}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Administrador registra produtos, estoque, vendas e repasses. Consulta apenas visualiza.
          O primeiro usuário cadastrado vira administrador.
        </p>
      </Panel>

      {profile.can_write ? (
        <Panel title="Estoque baixo" description="Limite usado nos alertas do dashboard" icon={PackageSearch}>
          <form
            className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => setLowStockThresholdAction(Number(limit)), "Limite de estoque baixo atualizado.");
            }}
          >
            <Field label="Estoque baixo a partir de" hint="O alerta considera o total de unidades do produto.">
              <Input
                className="h-12 font-display text-lg font-semibold"
                type="number"
                min={0}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
              />
            </Field>
            <Button type="submit" size="lg" disabled={pending}>
              Salvar limite
            </Button>
          </form>
        </Panel>
      ) : null}

      <Panel title="Pessoas" description={`${profiles.length} usuário(s)`} icon={Users} bodyClassName="p-0">
        <ul className="divide-y divide-border/70">
          {profiles.map((person) => (
            <li key={person.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_12rem] md:items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface font-display text-xs font-bold text-muted-foreground">
                  {initials(person.full_name)}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{person.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{person.email}</p>
                </div>
              </div>
              {profile.can_write ? (
                <Select
                  className="h-11"
                  value={person.role_code}
                  disabled={pending}
                  onChange={(event) =>
                    run(
                      () => setUserRoleAction(person.id, event.target.value),
                      "Papel atualizado.",
                    )
                  }
                >
                  <option value="admin">Administrador</option>
                  <option value="CONSULTAS">CONSULTAS</option>
                </Select>
              ) : (
                <Badge variant="neutral" className="w-fit">{person.role_name}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Tipos de cliente" description="Cada tipo tem seu preço em Produtos" icon={Tags}>
        <ul className="flex flex-wrap gap-2">
          {types.map((type) => (
            <li key={type.id}>
              <Badge variant={type.active ? "secondary" : "neutral"} className="h-8 px-3 text-xs normal-case tracking-normal">
                {type.name}
                {type.active ? "" : " · inativo"}
              </Badge>
            </li>
          ))}
        </ul>
        {profile.can_write ? (
          <form
            className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => saveCustomerTypeAction(typeName), "Tipo de cliente criado. Defina os preços em Produtos.");
              setTypeName("");
            }}
          >
            <Input
              className="h-11 min-w-0 flex-1"
              value={typeName}
              onChange={(event) => setTypeName(event.target.value)}
              placeholder="Novo tipo"
              required
            />
            <Button type="submit" variant="outline" className="w-full shrink-0 sm:w-auto" disabled={pending}>
              <Plus />
              Adicionar
            </Button>
          </form>
        ) : null}
      </Panel>

      <Panel title="Status de pagamento" icon={CreditCard}>
        <ul className="grid gap-2 text-sm">
          {statuses.map((status) => (
            <li
              key={status.id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/70 bg-surface px-3 py-2"
            >
              <span className="min-w-0 break-words font-medium">{status.name}</span>
              {status.active ? (
                <Badge variant="success">Ativo</Badge>
              ) : (
                <Badge variant="neutral">Preparado, inativo</Badge>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Recebido e A receber entram nas vendas. Parcialmente recebido e Cancelado já existem no banco para uma
          evolução futura, sem alterar o fluxo atual.
        </p>
      </Panel>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
