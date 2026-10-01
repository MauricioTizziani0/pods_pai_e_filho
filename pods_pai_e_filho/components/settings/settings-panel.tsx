"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <div className="grid gap-5">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-display text-xl">Seu acesso</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.full_name} · {profile.role_name}
          {profile.email ? ` · ${profile.email}` : ""}
        </p>
        <p className="mt-2 text-sm">
          Administrador registra produtos, estoque, vendas e repasses. Consulta apenas visualiza.
          O primeiro usuário cadastrado vira administrador.
        </p>
      </section>

      {profile.can_write ? (
        <form
          className="grid gap-3 rounded-2xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => setLowStockThresholdAction(Number(limit)), "Limite de estoque baixo atualizado.");
          }}
        >
          <Field label="Estoque baixo a partir de" hint="O dashboard destaca sabores com quantidade igual ou menor.">
            <Input className="h-12 rounded-xl text-base" type="number" min={0} value={limit} onChange={(event) => setLimit(event.target.value)} />
          </Field>
          <Button type="submit" className="h-12 rounded-xl" disabled={pending}>
            Salvar limite
          </Button>
        </form>
      ) : null}

      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-xl">Pessoas</h2>
        {profiles.map((person) => (
          <div key={person.id} className="grid gap-2 rounded-xl bg-muted/60 p-3 md:grid-cols-[1fr_12rem]">
            <div>
              <p className="font-medium">{person.full_name}</p>
              <p className="text-sm text-muted-foreground">{person.email}</p>
            </div>
            {profile.can_write ? (
              <Select
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
                <option value="viewer">Consulta</option>
              </Select>
            ) : (
              <p className="text-sm">{person.role_name}</p>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-xl">Tipos de cliente</h2>
        <ul className="grid gap-1 text-sm">
          {types.map((type) => (
            <li key={type.id}>
              {type.name}
              {type.active ? "" : " · inativo"}
            </li>
          ))}
        </ul>
        {profile.can_write ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => saveCustomerTypeAction(typeName), "Tipo de cliente criado. Defina os preços em Produtos.");
              setTypeName("");
            }}
          >
            <Input
              className="h-12 rounded-xl text-base"
              value={typeName}
              onChange={(event) => setTypeName(event.target.value)}
              placeholder="Novo tipo"
              required
            />
            <Button type="submit" variant="outline" className="h-12 rounded-xl" disabled={pending}>
              Adicionar
            </Button>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-display text-xl">Status de pagamento</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {statuses.map((status) => (
            <li key={status.id} className="flex items-center justify-between gap-3">
              <span>{status.name}</span>
              <span className="text-muted-foreground">{status.active ? "Ativo" : "Preparado, inativo"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Recebido e A receber entram nas vendas. Parcialmente recebido e Cancelado já existem no banco para uma evolução futura, sem alterar o fluxo atual.
        </p>
      </section>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
    </div>
  );
}
