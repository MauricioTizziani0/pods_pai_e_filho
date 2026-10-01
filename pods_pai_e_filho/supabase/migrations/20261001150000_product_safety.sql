-- Safe hard deletion for products that have never entered operational history.
create or replace function public.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if row(new.name, new.brand, new.model, new.approximate_puffs, new.active)
     is distinct from row(old.name, old.brand, old.model, old.approximate_puffs, old.active) then
    perform public.write_audit(
      auth.uid(),
      case when old.active is distinct from new.active
        then case when new.active then 'product.activated' else 'product.deactivated' end
        else 'product.updated' end,
      'products', new.id,
      jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

create trigger products_audit_update
  after update on public.products
  for each row execute function public.audit_product_change();

create or replace function public.delete_unused_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.has_write_access() then
    raise exception 'Sem permissão para excluir produtos';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Produto não encontrado'; end if;

  if exists (
    select 1 from public.product_variants v
    where v.product_id = p_product_id and (
      exists (select 1 from public.sale_items si where si.variant_id = v.id or si.product_id = p_product_id)
      or exists (select 1 from public.stock_movements sm where sm.variant_id = v.id or sm.product_id = p_product_id)
      or exists (select 1 from public.stock_count_lines scl where scl.variant_id = v.id or scl.product_id = p_product_id)
      or coalesce((select sb.quantity from public.stock_balances sb where sb.variant_id = v.id), 0) <> 0
    )
  ) or exists (select 1 from public.sale_items where product_id = p_product_id)
    or exists (select 1 from public.stock_movements where product_id = p_product_id)
    or exists (select 1 from public.stock_count_lines where product_id = p_product_id)
  then
    raise exception 'Este produto não pode ser excluído porque já possui movimentações ou vendas registradas. Você pode desativá-lo para impedir novos lançamentos.';
  end if;

  delete from public.price_rules where product_id = p_product_id;
  delete from public.product_variants where product_id = p_product_id;
  delete from public.products where id = p_product_id;
  perform public.write_audit(v_user, 'product.deleted', 'products', p_product_id, '{}'::jsonb);
end;
$$;

revoke all on function public.delete_unused_product(uuid) from public;
grant execute on function public.delete_unused_product(uuid) to authenticated;

create or replace function public.delete_unused_variant(p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.has_write_access() then raise exception 'Sem permissão para excluir sabores'; end if;
  perform 1 from public.product_variants where id = p_variant_id for update;
  if not found then raise exception 'Sabor não encontrado'; end if;
  if exists (select 1 from public.sale_items where variant_id = p_variant_id)
    or exists (select 1 from public.stock_movements where variant_id = p_variant_id)
    or exists (select 1 from public.stock_count_lines where variant_id = p_variant_id)
    or coalesce((select quantity from public.stock_balances where variant_id = p_variant_id), 0) <> 0
  then
    raise exception 'Este sabor não pode ser excluído porque já possui vendas, movimentações ou estoque. Você pode desativá-lo.';
  end if;
  delete from public.product_variants where id = p_variant_id;
  perform public.write_audit(v_user, 'variant.deleted', 'product_variants', p_variant_id, '{}'::jsonb);
end;
$$;
revoke all on function public.delete_unused_variant(uuid) from public;
grant execute on function public.delete_unused_variant(uuid) to authenticated;

-- Manual stock writes require both the variant and its parent product to be active.
create or replace function public.register_stock_movement(
  p_variant_id uuid, p_type text, p_quantity integer, p_date date, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_product uuid;
  v_manual boolean;
  v_id uuid;
begin
  if v_user is null then raise exception 'Não autenticado'; end if;
  if not public.has_write_access() then raise exception 'Sem permissão para movimentar estoque'; end if;
  select manual into v_manual from public.movement_types where code = p_type;
  if v_manual is distinct from true then raise exception 'Use apenas entrada ou ajuste manual nesta operação'; end if;
  select v.product_id into v_product
  from public.product_variants v join public.products p on p.id = v.product_id
  where v.id = p_variant_id and v.active and p.active;
  if v_product is null then raise exception 'Produto ou sabor inativo ou inválido'; end if;
  v_id := public.write_stock_movement(v_product, p_variant_id, p_type, p_quantity, p_date, null, nullif(trim(coalesce(p_notes, '')), ''), v_user);
  perform public.write_audit(v_user, 'stock.movement', 'stock_movements', v_id,
    jsonb_build_object('variant_id', p_variant_id, 'type', p_type, 'quantity', p_quantity, 'notes', p_notes));
  return v_id;
end;
$$;
revoke all on function public.register_stock_movement(uuid, text, integer, date, text) from public;
grant execute on function public.register_stock_movement(uuid, text, integer, date, text) to authenticated;

notify pgrst, 'reload schema';
