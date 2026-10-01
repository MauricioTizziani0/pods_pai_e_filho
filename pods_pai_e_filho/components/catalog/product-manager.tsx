"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, PackagePlus, Plus, Tag, Pencil, Trash2 } from "lucide-react";
import { deleteProductAction, deleteVariantAction, savePriceAction, saveProductAction, saveVariantAction } from "@/lib/actions/catalog";
import { formatBRL, moneyToInput } from "@/lib/format";
import type { CatalogSnapshot, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

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
        <Panel title="Novo produto" description="Depois inclua sabores e preços" icon={PackagePlus}>
          <form
            className="grid gap-4 md:grid-cols-2"
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
            <Field label="Nome">
              <Input className="h-12" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Marca">
              <Input className="h-12" value={brand} onChange={(event) => setBrand(event.target.value)} />
            </Field>
            <Field label="Modelo">
              <Input className="h-12" value={model} onChange={(event) => setModel(event.target.value)} />
            </Field>
            <Field label="Puffs aproximados">
              <Input className="h-12" inputMode="numeric" value={puffs} onChange={(event) => setPuffs(event.target.value)} />
            </Field>
            <Button type="submit" size="lg" className="md:col-span-2" disabled={pending}>
              <Plus />
              Cadastrar produto
            </Button>
          </form>
        </Panel>
      ) : null}

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}

      <div className="flex gap-2" role="group" aria-label="Filtrar produtos">
        {([["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]] as const).map(([value, label]) => (
          <Button key={value} variant={filter === value ? "secondary" : "ghost"} size="sm" onClick={() => setFilter(value)}>{label}</Button>
        ))}
      </div>
      <div className="stagger grid gap-4">
        {catalog.products.filter((p) => filter === "all" || p.active === (filter === "active")).map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            catalog={catalog}
            types={types}
            canWrite={canWrite}
            pending={pending}
            onSave={run}
            onDelete={(action, success) => run(action, success)}
          />
        ))}
      </div>
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
  onDelete,
}: {
  product: Product;
  catalog: CatalogSnapshot;
  types: CatalogSnapshot["customerTypes"];
  canWrite: boolean;
  pending: boolean;
  onSave: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
  onDelete: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
}) {
  const [flavor, setFlavor] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [model, setModel] = useState(product.model);
  const [puffs, setPuffs] = useState(product.approximate_puffs?.toString() ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const variants = catalog.variants.filter((variant) => variant.product_id === product.id);
  const stock = catalog.stock.filter((item) => item.product_id === product.id);
  const total = stock.reduce((sum, item) => sum + item.quantity, 0);
  const meta = [product.brand, product.model].filter(Boolean).join(" · ") || "Sem marca";

  return (
    <Panel
      title={product.name}
      description={`${meta}${product.approximate_puffs ? ` · ${product.approximate_puffs.toLocaleString("pt-BR")} puffs` : ""}`}
      icon={Boxes}
      accent={product.active}
      className={cn(!product.active && "opacity-70")}
      action={
        <div className="flex items-center gap-3">
          {!product.active ? <Badge variant="neutral">inativo</Badge> : null}
          <p className="text-right">
            <span className="block font-display text-2xl font-bold leading-none tabular-nums">{total}</span>
            <span className="eyebrow text-[10px]">em estoque</span>
          </p>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {editing ? (
          <form className="grid gap-3 md:grid-cols-2 lg:col-span-2" onSubmit={(e) => { e.preventDefault(); onSave(() => saveProductAction({ id: product.id, name, brand, model, approximatePuffs: puffs, active: product.active }), "Produto atualizado."); setEditing(false); }}>
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Marca"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
            <Field label="Modelo"><Input value={model} onChange={(e) => setModel(e.target.value)} /></Field>
            <Field label="Puffs aproximados"><Input inputMode="numeric" value={puffs} onChange={(e) => setPuffs(e.target.value)} /></Field>
            <div className="flex gap-2"><Button type="submit" disabled={pending}>Salvar alterações</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div>
          </form>
        ) : null}
        {/* Sabores */}
        <div>
          <p className="eyebrow mb-2">Sabores</p>
          <div className="grid gap-1.5">
            {variants.map((variant) => {
              const quantity = stock.find((item) => item.variant_id === variant.id)?.quantity ?? 0;
              return (
                <div
                  key={variant.id}
                  className="flex items-center justify-between rounded-md border border-border/70 bg-surface px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    {variant.name}
                    {!variant.active ? <Badge variant="neutral">inativo</Badge> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-display font-semibold tabular-nums">{quantity} un</span>
                    {canWrite ? <>
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onSave(
                        () => saveVariantAction({ id: variant.id, productId: product.id, name: variant.name, active: !variant.active }),
                        variant.active ? "Sabor desativado." : "Sabor reativado.",
                      )}>{variant.active ? "Desativar" : "Reativar"}</Button>
                      {!variant.has_history ? <Button type="button" size="sm" variant="ghost" disabled={pending} aria-label={`Excluir ${variant.name}`} onClick={() => {
                        if (window.confirm(`Excluir o sabor ${variant.name}? Esta ação não poderá ser desfeita.`)) {
                          onSave(() => deleteVariantAction(variant.id), "Sabor excluído.");
                        }
                      }}><Trash2 /></Button> : null}
                    </> : null}
                  </span>
                </div>
              );
            })}
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum sabor cadastrado.</p>
            ) : null}
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
                className="h-11"
                value={flavor}
                onChange={(event) => setFlavor(event.target.value)}
                placeholder="Novo sabor"
                required
              />
              <Button type="submit" variant="outline" disabled={pending}>
                <Plus />
                Adicionar
              </Button>
            </form>
          ) : null}
        </div>

        {/* Preços */}
        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Preços por tipo de cliente
          </p>
          <div className="grid gap-2">
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
        </div>
      </div>

      {canWrite ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(!editing)}><Pencil />Editar</Button>
          {product.has_history ? <Button
            type="button"
            variant="ghost"
            size="sm"
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
          </Button> : null}
          {!product.has_history ? <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 />Excluir</Button> : null}
        </div>
      ) : null}
      {confirmDelete && !product.has_history ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`delete-title-${product.id}`} className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
            <h3 id={`delete-title-${product.id}`} className="font-display text-lg font-semibold">Excluir {product.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">Este produto ainda não possui vendas ou movimentações e pode ser excluído permanentemente. O sistema verificará novamente antes de excluir.</p>
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button><Button variant="destructive" disabled={pending} onClick={() => { setConfirmDelete(false); onDelete(() => deleteProductAction(product.id), "Produto excluído."); }}>Excluir produto</Button></div>
          </section>
        </div>
      ) : null}
    </Panel>
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
      className="grid gap-2 rounded-md border border-border/70 bg-surface p-3 md:grid-cols-[7rem_1fr_1fr_auto] md:items-end"
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
        <p className="text-xs text-muted-foreground">
          Lucro <span className="font-medium text-success">{profit}</span>
        </p>
      </div>
      <label className="grid gap-1">
        <span className="eyebrow text-[10px]">Preço</span>
        <Input
          className="h-11"
          value={sale}
          onChange={(event) => setSale(event.target.value)}
          inputMode="decimal"
          aria-label={`Preço ${typeName}`}
          placeholder="0,00"
          disabled={!canWrite}
        />
      </label>
      <label className="grid gap-1">
        <span className="eyebrow text-[10px]">Repasse ao pai</span>
        <Input
          className="h-11"
          value={father}
          onChange={(event) => setFather(event.target.value)}
          inputMode="decimal"
          aria-label={`Repasse ${typeName}`}
          placeholder="0,00"
          disabled={!canWrite}
        />
      </label>
      {canWrite ? (
        <Button type="submit" variant="outline" disabled={pending}>
          Salvar
        </Button>
      ) : null}
    </form>
  );
}
