"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCustomerAction } from "@/lib/actions/catalog";
import type { CatalogSnapshot, Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";

export function CustomerManager({
  catalog,
  canWrite,
}: {
  catalog: CatalogSnapshot;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [typeId, setTypeId] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const types = catalog.customerTypes.filter((type) => type.active);

  function edit(customer: Customer) {
    setEditing(customer);
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setNotes(customer.notes ?? "");
    setTypeId(customer.customer_type_id ?? "");
    setActive(customer.active);
  }

  function reset() {
    setEditing(null);
    setName("");
    setPhone("");
    setNotes("");
    setTypeId("");
    setActive(true);
  }

  return (
    <div className="grid gap-5">
      {canWrite ? (
        <form
          className="grid gap-4 rounded-2xl border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await saveCustomerAction({
                id: editing?.id,
                name,
                phone,
                notes,
                customerTypeId: typeId,
                active,
              });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setMessage(editing ? "Cliente atualizado." : "Cliente cadastrado.");
              reset();
              router.refresh();
            });
          }}
        >
          <h2 className="font-display text-xl">{editing ? "Editar cliente" : "Novo cliente"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome">
              <Input className="h-12 rounded-xl text-base" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Telefone">
              <Input className="h-12 rounded-xl text-base" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Tipo padrão">
              <Select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                <option value="">Sem tipo padrão</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="h-12 rounded-xl" disabled={pending}>
              {pending ? "Salvando..." : "Salvar cliente"}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" className="h-12" onClick={reset}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <div className="grid gap-3">
        {catalog.customers.map((customer) => {
          const type = catalog.customerTypes.find((item) => item.id === customer.customer_type_id);
          return (
            <article key={customer.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {customer.name}
                    {customer.active ? "" : " · inativo"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customer.phone || "Sem telefone"}
                    {type ? ` · ${type.name}` : ""}
                  </p>
                  {customer.notes ? <p className="mt-1 text-sm">{customer.notes}</p> : null}
                </div>
                {canWrite ? (
                  <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => edit(customer)}>
                    Editar
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
