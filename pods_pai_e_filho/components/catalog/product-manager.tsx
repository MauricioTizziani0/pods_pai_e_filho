"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePriceAction, saveProductAction, saveVariantAction } from "@/lib/actions/catalog";
import { formatBRL, moneyToInput } from "@/lib/format";
import type { CatalogSnapshot, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";

export function ProductManager({
  catalog,
  canWrite,
}: {
  catalog: CatalogSnapshot;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [puffs, setPuffs] = useState("");

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

  const types = catalog.customerTypes.filter((type) => type.active);

  return (
    <div className="grid gap-5">
      {canWrite ? (
        <form
          className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await saveProductAction({
                name,
                brand,
                model,
                approximatePuffs: puffs,
                active: true,
              });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setMessage("Produto cadastrado. Agora inclua sabores e preços.");
              setName("");
              setBrand("");
              setModel("");
              setPuffs("");
              router.refresh();
            });
          }}
        >
          <h2 className="font-display text-xl md:col-span-2">Novo produto</h2>
          <Field label="Nome">
            <Input className="h-12 rounded-xl text-base" value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Marca">
            <Input className="h-12 rounded-xl text-base" value={brand} onChange={(event) => setBrand(event.target.value)} />
          </Field>
          <Field label="Modelo">
            <Input className="h-12 rounded-xl text-base" value={model} onChange={(event) => setModel(event.target.value)} />
          </Field>
          <Field label="Puffs aproximados">
            <Input className="h-12 rounded-xl text-base" inputMode="numeric" value={puffs} onChange={(event) => setPuffs(event.target.value)} />
          </Field>
          <Button type="submit" className="h-12 rounded-xl md:col-span-2" disabled={pending}>
            Cadastrar produto
          </Button>
        </form>
      ) : null}

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}

      {catalog.products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          catalog={catalog}
          types={types}
          canWrite={canWrite}
          pending={pending}
          onSave={run}
        />
      ))}
    </div>
  );
}

function ProductCard({
  product,
  catalog,
  types,
  canWrite,
  pending,
  onSave,
}: {
  product: Product;
  catalog: CatalogSnapshot;
  types: CatalogSnapshot["customerTypes"];
  canWrite: boolean;
  pending: boolean;
  onSave: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
}) {
  const [flavor, setFlavor] = useState("");
  const variants = catalog.variants.filter((variant) => variant.product_id === product.id);
  const stock = catalog.stock.filter((item) => item.product_id === product.id);
  const total = stock.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{product.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[product.brand, product.model].filter(Boolean).join(" · ") || "Sem marca"}
            {product.approximate_puffs ? ` · ${product.approximate_puffs.toLocaleString("pt-BR")} puffs` : ""}
            {product.active ? "" : " · inativo"}
          </p>
        </div>
        <p className="text-right text-sm">
          <span className="block text-muted-foreground">Estoque</span>
          <span className="text-lg font-semibold tabular-nums">{total}</span>
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {variants.map((variant) => {
          const quantity = stock.find((item) => item.variant_id === variant.id)?.quantity ?? 0;
          return (
            <div key={variant.id} className="flex items-center justify-between rounded-xl bg-muted/70 px-3 py-2 text-sm">
              <span>
                {variant.name}
                {variant.active ? "" : " · inativo"}
              </span>
              <span className="tabular-nums">{quantity} un</span>
            </div>
          );
        })}
        {variants.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum sabor cadastrado.</p> : null}
      </div>

      {canWrite ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(
              () => saveVariantAction({ productId: product.id, name: flavor, active: true }),
              "Sabor adicionado.",
            );
            setFlavor("");
          }}
        >
          <Input
            className="h-12 rounded-xl text-base"
            value={flavor}
            onChange={(event) => setFlavor(event.target.value)}
            placeholder="Novo sabor"
            required
          />
          <Button type="submit" variant="outline" className="h-12 rounded-xl" disabled={pending}>
            Adicionar
          </Button>
        </form>
      ) : null}

      <div className="mt-5 grid gap-3">
        <h3 className="text-sm font-semibold">Preços</h3>
        {types.map((type) => {
          const rule = catalog.prices.find(
            (price) => price.product_id === product.id && price.customer_type_id === type.id,
          );
          return (
            <PriceRow
              key={type.id}
              productId={product.id}
              typeId={type.id}
              typeName={type.name}
              salePrice={rule ? moneyToInput(rule.sale_price) : ""}
              transfer={rule ? moneyToInput(rule.father_transfer) : ""}
              profit={rule ? formatBRL(rule.unit_profit) : "—"}
              canWrite={canWrite}
              pending={pending}
              onSave={onSave}
            />
          );
        })}
      </div>

      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-3"
          disabled={pending}
          onClick={() =>
            onSave(
              () =>
                saveProductAction({
                  id: product.id,
                  name: product.name,
                  brand: product.brand,
                  model: product.model,
                  approximatePuffs: product.approximate_puffs?.toString() ?? "",
                  active: !product.active,
                }),
              product.active ? "Produto inativado." : "Produto reativado.",
            )
          }
        >
          {product.active ? "Inativar produto" : "Reativar produto"}
        </Button>
      ) : null}
    </article>
  );
}

function PriceRow({
  productId,
  typeId,
  typeName,
  salePrice,
  transfer,
  profit,
  canWrite,
  pending,
  onSave,
}: {
  productId: string;
  typeId: string;
  typeName: string;
  salePrice: string;
  transfer: string;
  profit: string;
  canWrite: boolean;
  pending: boolean;
  onSave: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
}) {
  const [sale, setSale] = useState(salePrice);
  const [father, setFather] = useState(transfer);

  return (
    <form
      className="grid gap-2 rounded-xl border p-3 md:grid-cols-[8rem_1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          () =>
            savePriceAction({
              productId,
              customerTypeId: typeId,
              salePrice: sale,
              fatherTransfer: father,
            }),
          `Preço de ${typeName} atualizado.`,
        );
      }}
    >
      <div className="self-center">
        <p className="font-medium">{typeName}</p>
        <p className="text-xs text-muted-foreground">Lucro {profit}</p>
      </div>
      <Input
        className="h-12 rounded-xl text-base"
        value={sale}
        onChange={(event) => setSale(event.target.value)}
        inputMode="decimal"
        aria-label={`Preço ${typeName}`}
        placeholder="Preço"
        disabled={!canWrite}
      />
      <Input
        className="h-12 rounded-xl text-base"
        value={father}
        onChange={(event) => setFather(event.target.value)}
        inputMode="decimal"
        aria-label={`Repasse ${typeName}`}
        placeholder="Repasse ao pai"
        disabled={!canWrite}
      />
      {canWrite ? (
        <Button type="submit" variant="outline" className="h-12 rounded-xl" disabled={pending}>
          Salvar
        </Button>
      ) : null}
    </form>
  );
}
