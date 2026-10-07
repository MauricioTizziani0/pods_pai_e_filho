"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, PackagePlus, Plus, Tag, Pencil, Trash2 } from "lucide-react";
import { deleteProductAction, deleteVariantAction, savePriceAction, saveProductAction, saveVariantAction } from "@/lib/actions/catalog";
import {
  getFlavorDisplayName,
  matchesFlavorSearch,
  matchesIceFilter,
  nameEndsWithIce,
  normalizeFlavorName,
  type IceFilter,
} from "@/lib/domain/flavors";
import { formatBRL, moneyToInput, parseMoney } from "@/lib/format";
import type { CatalogSnapshot, Product, ProductVariant } from "@/lib/types";
import type { ProductStatusFilter } from "@/lib/data/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { FlavorLabel } from "@/components/sales/badges";
import { FlavorIceCheckbox } from "@/components/catalog/flavor-ice-field";
import { cn } from "@/lib/utils";

export function ProductManager({
  catalog,
  productStatus,
  canWrite,
  isAdmin,
}: {
  catalog: CatalogSnapshot;
  productStatus: ProductStatusFilter;
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [puffs, setPuffs] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [promotionName, setPromotionName] = useState("");
  const [promotionFeatures, setPromotionFeatures] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [iceFilter, setIceFilter] = useState<IceFilter>("all");
  const [flavorQuery, setFlavorQuery] = useState("");

  function selectProductStatus(value: ProductStatusFilter) {
    if (value === productStatus) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", value);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

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
  const visibleProducts = catalog.products.filter((product) => {
    if (iceFilter === "all" && !flavorQuery.trim()) return true;
    return catalog.variants.some(
      (variant) =>
        variant.product_id === product.id &&
        matchesIceFilter(variant.is_ice, iceFilter) &&
        matchesFlavorSearch(variant, flavorQuery),
    );
  });

  return (
    <div className="grid w-full min-w-0 gap-5">
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
                  costPrice,
                  active: true,
                  ...(isAdmin ? { promotionName, promotionFeatures, displayOrder } : {}),
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
                setCostPrice("");
                setPromotionName("");
                setPromotionFeatures("");
                setDisplayOrder("");
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
            {!isAdmin ? <Field label="Puffs aproximados">
              <Input className="h-12" inputMode="numeric" value={puffs} onChange={(event) => setPuffs(event.target.value)} />
            </Field> : null}
            <Field label="Preço de custo" hint="Obrigatório antes de registrar uma venda deste produto.">
              <Input className="h-12" inputMode="decimal" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} placeholder="0,00" />
            </Field>
            {isAdmin ? (
              <PromotionFields
                idPrefix="new-product"
                promotionName={promotionName}
                setPromotionName={setPromotionName}
                puffs={puffs}
                setPuffs={setPuffs}
                promotionFeatures={promotionFeatures}
                setPromotionFeatures={setPromotionFeatures}
                displayOrder={displayOrder}
                setDisplayOrder={setDisplayOrder}
              />
            ) : null}
            <Button type="submit" size="lg" className="md:col-span-2" disabled={pending}>
              <Plus />
              Cadastrar produto
            </Button>
          </form>
        </Panel>
      ) : null}

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}

      <div className="grid gap-3">
        <Input
          className="h-11"
          value={flavorQuery}
          onChange={(event) => setFlavorQuery(event.target.value)}
          placeholder="Pesquisar sabor (ex.: Grape Ice)"
          aria-label="Pesquisar sabor"
        />
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar produtos">
            <span className="eyebrow">Produtos</span>
            {([["active", "Ativos"], ["inactive", "Inativos"], ["all", "Todos"]] as const).map(([value, label]) => (
              <Button key={value} variant={productStatus === value ? "secondary" : "ghost"} size="sm" disabled={pending} aria-pressed={productStatus === value} onClick={() => selectProductStatus(value)}>{label}</Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar sabores Ice">
            <span className="eyebrow">Sabores</span>
            {([["all", "Todos"], ["ice", "Ice"], ["nao_ice", "Não Ice"]] as const).map(([value, label]) => (
              <Button key={value} variant={iceFilter === value ? "secondary" : "ghost"} size="sm" onClick={() => setIceFilter(value)}>{label}</Button>
            ))}
          </div>
        </div>
      </div>
      <div className="stagger grid gap-4">
        {visibleProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            catalog={catalog}
            types={types}
            canWrite={canWrite}
            isAdmin={isAdmin}
            pending={pending}
            iceFilter={iceFilter}
            flavorQuery={flavorQuery}
            onSave={run}
            onDelete={(action, success) => run(action, success)}
          />
        ))}
        {visibleProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sabor encontrado neste filtro.</p>
        ) : null}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  catalog,
  types,
  canWrite,
  isAdmin,
  pending,
  iceFilter,
  flavorQuery,
  onSave,
  onDelete,
}: {
  product: Product;
  catalog: CatalogSnapshot;
  types: CatalogSnapshot["customerTypes"];
  canWrite: boolean;
  isAdmin: boolean;
  pending: boolean;
  iceFilter: IceFilter;
  flavorQuery: string;
  onSave: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
  onDelete: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
}) {
  const [flavor, setFlavor] = useState("");
  const [flavorIce, setFlavorIce] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [model, setModel] = useState(product.model);
  const [puffs, setPuffs] = useState(product.approximate_puffs?.toString() ?? "");
  const [costPrice, setCostPrice] = useState(product.cost_price == null ? "" : moneyToInput(product.cost_price));
  const [promotionName, setPromotionName] = useState(product.promotion_name ?? "");
  const [promotionFeatures, setPromotionFeatures] = useState((product.promotion_features ?? []).join("\n"));
  const [displayOrder, setDisplayOrder] = useState(product.display_order?.toString() ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const variants = catalog.variants.filter(
    (variant) =>
      variant.product_id === product.id &&
      matchesIceFilter(variant.is_ice, iceFilter) &&
      matchesFlavorSearch(variant, flavorQuery),
  );
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
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
          <p className="text-right">
            <span className="block font-display text-base font-semibold leading-none tabular-nums">
              {product.cost_price == null ? "Não configurado" : formatBRL(product.cost_price)}
            </span>
            <span className="eyebrow text-[10px]">preço de custo</span>
          </p>
          {!product.active ? <Badge variant="neutral">inativo</Badge> : null}
          <p className="text-right">
            <span className="block font-display text-2xl font-bold leading-none tabular-nums">{total}</span>
            <span className="eyebrow text-[10px]">em estoque</span>
          </p>
        </div>
      }
    >
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {editing ? (
          <form
            className="grid min-w-0 gap-3 md:grid-cols-2 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(async () => {
                const result = await saveProductAction({
                  id: product.id,
                  name,
                  brand,
                  model,
                  approximatePuffs: puffs,
                  costPrice,
                  active: product.active,
                  ...(isAdmin ? { promotionName, promotionFeatures, displayOrder } : {}),
                });
                if (result.ok) setEditing(false);
                return result;
              }, "Produto atualizado.");
            }}
          >
            <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Marca"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
            <Field label="Modelo"><Input value={model} onChange={(e) => setModel(e.target.value)} /></Field>
            {!isAdmin ? <Field label="Puffs aproximados"><Input inputMode="numeric" value={puffs} onChange={(e) => setPuffs(e.target.value)} /></Field> : null}
            <Field label="Preço de custo" hint="Obrigatório antes de registrar uma venda."><Input inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0,00" /></Field>
            {isAdmin ? (
              <PromotionFields
                idPrefix={`product-${product.id}`}
                promotionName={promotionName}
                setPromotionName={setPromotionName}
                puffs={puffs}
                setPuffs={setPuffs}
                promotionFeatures={promotionFeatures}
                setPromotionFeatures={setPromotionFeatures}
                displayOrder={displayOrder}
                setDisplayOrder={setDisplayOrder}
              />
            ) : null}
            <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={pending}>Salvar alterações</Button><Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div>
          </form>
        ) : null}
        {/* Sabores */}
        <div>
          <p className="eyebrow mb-2">Sabores</p>
          <div className="grid gap-1.5">
            {variants.map((variant) => {
              const quantity = stock.find((item) => item.variant_id === variant.id)?.quantity ?? 0;
              return (
                <FlavorRow
                  key={variant.id}
                  variant={variant}
                  quantity={quantity}
                  canWrite={canWrite}
                  pending={pending}
                  onSave={onSave}
                />
              );
            })}
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {iceFilter !== "all" || flavorQuery.trim() ? "Nenhum sabor neste filtro." : "Nenhum sabor cadastrado."}
              </p>
            ) : null}
          </div>

          {canWrite ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSave(
                  () =>
                    saveVariantAction({
                      productId: product.id,
                      name: flavor,
                      isIce: flavorIce,
                      active: true,
                    }),
                  "Sabor adicionado.",
                );
                setFlavor("");
                setFlavorIce(false);
              }}
            >
              <Field label="Nome do sabor">
                <Input
                  className="h-11"
                  value={flavor}
                  onChange={(event) => setFlavor(event.target.value)}
                  placeholder="Grape"
                  required
                />
              </Field>
              <FlavorIceCheckbox checked={flavorIce} onCheckedChange={setFlavorIce} />
              <FlavorPreview name={flavor} isIce={flavorIce} />
              <Button type="submit" variant="outline" disabled={pending}>
                <Plus />
                Adicionar
              </Button>
            </form>
          ) : null}
        </div>

        {/* Preços */}
        {canWrite ? <div>
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
                  cost={product.cost_price}
                  canWrite={canWrite}
                  pending={pending}
                  onSave={onSave}
                />
              );
            })}
          </div>
        </div> : null}
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
                    costPrice: product.cost_price == null ? "" : moneyToInput(product.cost_price),
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
          <section role="dialog" aria-modal="true" aria-labelledby={`delete-title-${product.id}`} className="w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
            <h3 id={`delete-title-${product.id}`} className="break-words font-display text-lg font-semibold">Excluir {product.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">Este produto ainda não possui vendas ou movimentações e pode ser excluído permanentemente. O sistema verificará novamente antes de excluir.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button><Button variant="destructive" disabled={pending} onClick={() => { setConfirmDelete(false); onDelete(() => deleteProductAction(product.id), "Produto excluído."); }}>Excluir produto</Button></div>
          </section>
        </div>
      ) : null}
    </Panel>
  );
}

function PromotionFields({
  idPrefix,
  promotionName,
  setPromotionName,
  puffs,
  setPuffs,
  promotionFeatures,
  setPromotionFeatures,
  displayOrder,
  setDisplayOrder,
}: {
  idPrefix: string;
  promotionName: string;
  setPromotionName: (value: string) => void;
  puffs: string;
  setPuffs: (value: string) => void;
  promotionFeatures: string;
  setPromotionFeatures: (value: string) => void;
  displayOrder: string;
  setDisplayOrder: (value: string) => void;
}) {
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-md border border-border/70 p-3 md:col-span-2 md:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Informações para divulgação</legend>
      <Field label="Nome para divulgação" htmlFor={`${idPrefix}-promotion-name`} hint="Se ficar vazio, a mensagem usará o nome do produto.">
        <Input id={`${idPrefix}-promotion-name`} maxLength={160} value={promotionName} onChange={(event) => setPromotionName(event.target.value)} />
      </Field>
      <Field label="Quantidade de puffs" htmlFor={`${idPrefix}-puffs`} hint="Use a quantidade aproximada do produto. Ex.: 30000 será exibido como 30K Puffs.">
        <Input id={`${idPrefix}-puffs`} type="number" inputMode="numeric" min={0} step={1} value={puffs} onChange={(event) => setPuffs(event.target.value)} />
      </Field>
      <Field label="Características adicionais" htmlFor={`${idPrefix}-promotion-features`} className="md:col-span-2" hint="Uma característica por linha, até 20 linhas de 160 caracteres. Use somente texto.">
        <TextArea id={`${idPrefix}-promotion-features`} maxLength={3200} rows={3} value={promotionFeatures} onChange={(event) => setPromotionFeatures(event.target.value)} />
      </Field>
      <Field label="Ordem de exibição" htmlFor={`${idPrefix}-display-order`} hint="Opcional. Números menores aparecem primeiro na mensagem.">
        <Input id={`${idPrefix}-display-order`} type="number" inputMode="numeric" min={0} max={2147483647} step={1} value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} />
      </Field>
    </fieldset>
  );
}

function FlavorPreview({ name, isIce }: { name: string; isIce: boolean }) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const stored = normalizeFlavorName(trimmed, isIce);
  const display = getFlavorDisplayName({ name: stored, is_ice: isIce });
  return (
    <div className="grid gap-1 text-xs text-muted-foreground">
      <p>
        Exibição: <span className="font-medium text-foreground">{display}</span>
      </p>
      {isIce && nameEndsWithIce(trimmed) && stored !== trimmed ? (
        <p>O “Ice” do nome será separado. Cadastro: {stored} + É Ice.</p>
      ) : null}
      {!isIce && nameEndsWithIce(trimmed) ? (
        <p>O nome termina em Ice. Marque “É Ice” para guardar só o sabor e evitar duplicar o sufixo.</p>
      ) : null}
    </div>
  );
}

function FlavorRow({
  variant,
  quantity,
  canWrite,
  pending,
  onSave,
}: {
  variant: ProductVariant;
  quantity: number;
  canWrite: boolean;
  pending: boolean;
  onSave: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(variant.name);
  const [isIce, setIsIce] = useState(Boolean(variant.is_ice));
  const displayName = getFlavorDisplayName(variant);

  if (editing && canWrite) {
    return (
      <form
        className="grid gap-2 rounded-md border border-border/70 bg-surface px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            () =>
              saveVariantAction({
                id: variant.id,
                productId: variant.product_id,
                name,
                isIce,
                active: variant.active,
              }),
            "Sabor atualizado.",
          );
          setEditing(false);
        }}
      >
        <Field label="Nome do sabor">
          <Input className="h-11" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <FlavorIceCheckbox checked={isIce} onCheckedChange={setIsIce} />
        <FlavorPreview name={name} isIce={isIce} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Salvar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(variant.name);
              setIsIce(Boolean(variant.is_ice));
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-surface px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <FlavorLabel name={variant.name} isIce={variant.is_ice} />
        {!variant.active ? <Badge variant="neutral">inativo</Badge> : null}
      </span>
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        <span className="font-display font-semibold tabular-nums">{quantity} un</span>
        {canWrite ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setName(variant.name);
                setIsIce(Boolean(variant.is_ice));
                setEditing(true);
              }}
            >
              <Pencil />
              Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                onSave(
                  () =>
                    saveVariantAction({
                      id: variant.id,
                      productId: variant.product_id,
                      name: variant.name,
                      isIce: variant.is_ice,
                      active: !variant.active,
                    }),
                  variant.active ? "Sabor desativado." : "Sabor reativado.",
                )
              }
            >
              {variant.active ? "Desativar" : "Reativar"}
            </Button>
            {!variant.has_history ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                aria-label={`Excluir ${displayName}`}
                onClick={() => {
                  if (window.confirm(`Excluir o sabor ${displayName}? Esta ação não poderá ser desfeita.`)) {
                    onSave(() => deleteVariantAction(variant.id), "Sabor excluído.");
                  }
                }}
              >
                <Trash2 />
              </Button>
            ) : null}
          </>
        ) : null}
      </span>
    </div>
  );
}

function PriceRow({
  productId,
  typeId,
  typeName,
  salePrice,
  transfer,
  profit,
  cost,
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
  cost: string | null;
  canWrite: boolean;
  pending: boolean;
  onSave: (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => void;
}) {
  const [sale, setSale] = useState(salePrice);
  const [father, setFather] = useState(transfer);
  const transferValue = parseMoney(father);
  const fatherProfit = cost == null || transferValue == null ? null : transferValue - Number(cost);

  return (
    <form
      className="grid min-w-0 gap-2 rounded-md border border-border/70 bg-surface p-3 md:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
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
        <p className="grid text-xs text-muted-foreground">
          <span>Lucro do pai <span className="font-medium text-primary">{cost == null ? "custo pendente" : fatherProfit == null ? "—" : formatBRL(fatherProfit)}</span></span>
          <span>Lucro do filho <span className="font-medium text-success">{profit}</span></span>
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
