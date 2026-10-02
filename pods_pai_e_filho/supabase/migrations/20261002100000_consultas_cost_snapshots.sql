-- Cost snapshots and a read-only CONSULTAS profile.
-- Existing products and sale items intentionally keep NULL cost: historical
-- values must not be guessed during migration.

alter table public.products
  add column if not exists cost_price numeric(14, 2);

alter table public.products
  drop constraint if exists products_cost_price_non_negative;
alter table public.products
  add constraint products_cost_price_non_negative
  check (cost_price is null or cost_price >= 0);

alter table public.sale_items
  add column if not exists cost_price_unit numeric(14, 2);
alter table public.sale_items
  add column if not exists unit_father_profit numeric(14, 2)
  generated always as (
    case when cost_price_unit is null then null else unit_transfer - cost_price_unit end
  ) stored;
alter table public.sale_items
  add column if not exists line_cost numeric(14, 2)
  generated always as (
    case when cost_price_unit is null then null else (quantity::numeric * cost_price_unit)::numeric(14, 2) end
  ) stored;
alter table public.sale_items
  add column if not exists line_father_profit numeric(14, 2)
  generated always as (
    case when cost_price_unit is null then null else (quantity::numeric * (unit_transfer - cost_price_unit))::numeric(14, 2) end
  ) stored;

alter table public.sale_items
  drop constraint if exists sale_items_cost_price_non_negative;
alter table public.sale_items
  add constraint sale_items_cost_price_non_negative
  check (cost_price_unit is null or cost_price_unit >= 0);
alter table public.sale_items
  drop constraint if exists sale_items_transfer_covers_cost;
alter table public.sale_items
  add constraint sale_items_transfer_covers_cost
  check (cost_price_unit is null or unit_transfer >= cost_price_unit);

create or replace function public.snapshot_sale_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric(14, 2);
begin
  if tg_op = 'INSERT' then
    select cost_price into v_cost
    from public.products
    where id = new.product_id and active;

    if v_cost is null then
      raise exception 'Preço de custo não configurado para este produto';
    end if;
    new.cost_price_unit := v_cost;
  elsif new.product_id is distinct from old.product_id then
    select cost_price into v_cost
    from public.products
    where id = new.product_id and active;

    if v_cost is null then
      raise exception 'Preço de custo não configurado para este produto';
    end if;
    new.cost_price_unit := v_cost;
  else
    -- Cost is an immutable part of the sale snapshot. In particular, editing
    -- an old sale must not fill in an unknown historical cost.
    new.cost_price_unit := old.cost_price_unit;
  end if;

  if new.cost_price_unit < 0 then
    raise exception 'Preço de custo deve ser maior ou igual a zero';
  end if;
  if new.unit_transfer < new.cost_price_unit then
    raise exception 'O repasse não pode ser menor que o preço de custo';
  end if;
  if new.unit_price < new.unit_transfer then
    raise exception 'O preço de venda não pode ser menor que o repasse ao pai';
  end if;
  return new;
end;
$$;

drop trigger if exists sale_items_cost_snapshot on public.sale_items;
create trigger sale_items_cost_snapshot
  before insert or update of product_id, variant_id, quantity, unit_price, unit_transfer, cost_price_unit
  on public.sale_items
  for each row execute function public.snapshot_sale_item_cost();

create or replace function public.validate_product_cost_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.cost_price is not null and exists (
    select 1 from public.price_rules pr
    where pr.product_id = new.id and pr.active and pr.father_transfer < new.cost_price
  ) then
    raise exception 'O preço de custo não pode superar um repasse configurado. Atualize os repasses primeiro.';
  end if;
  return new;
end;
$$;

drop trigger if exists products_validate_cost_price on public.products;
create trigger products_validate_cost_price
  before insert or update of cost_price on public.products
  for each row execute function public.validate_product_cost_price();

create or replace function public.validate_price_rule_cost()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cost numeric(14, 2);
begin
  select cost_price into v_cost from public.products where id = new.product_id;
  if v_cost is not null and new.father_transfer < v_cost then
    raise exception 'O repasse não pode ser menor que o preço de custo';
  end if;
  return new;
end;
$$;

drop trigger if exists price_rules_validate_cost on public.price_rules;
create trigger price_rules_validate_cost
  before insert or update of product_id, father_transfer, active on public.price_rules
  for each row execute function public.validate_price_rule_cost();

-- Use an explicit role code while retaining the existing can_write/RLS model.
insert into public.roles (code, name, can_write)
values ('CONSULTAS', 'CONSULTAS', false)
on conflict (code) do update set name = excluded.name, can_write = false;

update public.profiles set role_code = 'CONSULTAS' where role_code = 'viewer';
alter table public.profiles alter column role_code set default 'CONSULTAS';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  perform pg_advisory_xact_lock(764221);
  if (select count(*) from public.profiles) = 0 then
    v_role := 'admin';
  else
    v_role := 'CONSULTAS';
  end if;

  insert into public.profiles (id, full_name, email, role_code)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_role
  );
  return new;
end;
$$;

-- Separate reporting RPC keeps the existing Administrator dashboard contract
-- unchanged. RLS remains in force because the function is SECURITY INVOKER.
create or replace function public.consultas_financial_summary(
  p_from date default null,
  p_to date default null,
  p_product_id uuid default null,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_type_id uuid default null,
  p_payment_status_id uuid default null,
  p_is_credit boolean default null,
  p_is_ice boolean default null,
  p_flavor text default null
)
returns table (
  sales_count bigint,
  units_sold bigint,
  due_now_sales bigint,
  future_sales bigint,
  revenue numeric,
  cost_sold numeric,
  cost_missing_items bigint,
  transfer_total numeric,
  transfer_received numeric,
  transfer_due_now numeric,
  transfer_future numeric,
  father_profit_total numeric,
  father_profit_received numeric,
  father_profit_missing_items bigint,
  father_profit_missing_received_items bigint,
  stock_cost_total numeric,
  stock_cost_missing_products bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered_sales as (
    select s.*
    from public.sales_overview s
    where s.is_valid
      and (p_from is null or s.sale_date >= p_from)
      and (p_to is null or s.sale_date <= p_to)
      and (p_customer_type_id is null or s.customer_type_id = p_customer_type_id)
      and (p_payment_status_id is null or s.payment_status_id = p_payment_status_id)
      and (p_is_credit is null or s.is_credit = p_is_credit)
      and (p_customer_id is null or s.customer_id = p_customer_id)
      and (
        nullif(trim(coalesce(p_customer_name, '')), '') is null
        or s.customer_name ilike '%' || trim(p_customer_name) || '%'
      )
  ),
  filtered_items as (
    select si.*, fs.transfer_paid, fs.transfer_due_now, fs.transfer_is_future
    from public.sale_items si
    join filtered_sales fs on fs.id = si.sale_id
    left join public.product_variants v on v.id = si.variant_id
    where (p_product_id is null or si.product_id = p_product_id)
      and (p_is_ice is null or v.is_ice = p_is_ice)
      and (
        nullif(trim(coalesce(p_flavor, '')), '') is null
        or si.variant_name ilike '%' || trim(p_flavor) || '%'
        or public.flavor_display_name(v.name, v.is_ice) ilike '%' || trim(p_flavor) || '%'
        or (v.is_ice and lower(trim(p_flavor)) = 'ice')
        or (
          v.is_ice
          and lower(trim(p_flavor)) ~* '[[:space:]]ice$'
          and v.name ilike '%' || regexp_replace(trim(p_flavor), '[[:space:]]+ice$', '', 'i') || '%'
        )
      )
  ),
  totals as (
    select
      count(distinct sale_id)::bigint as sales_count,
      coalesce(sum(quantity), 0)::bigint as units_sold,
      count(distinct sale_id) filter (where transfer_due_now)::bigint as due_now_sales,
      count(distinct sale_id) filter (where transfer_is_future)::bigint as future_sales,
      coalesce(sum(line_total), 0)::numeric(14, 2) as revenue,
      coalesce(sum(line_cost) filter (where cost_price_unit is not null), 0)::numeric(14, 2) as cost_sold,
      count(*) filter (where cost_price_unit is null)::bigint as cost_missing_items,
      coalesce(sum(line_transfer), 0)::numeric(14, 2) as transfer_total,
      coalesce(sum(line_transfer) filter (where transfer_paid), 0)::numeric(14, 2) as transfer_received,
      coalesce(sum(line_transfer) filter (where transfer_due_now), 0)::numeric(14, 2) as transfer_due_now,
      coalesce(sum(line_transfer) filter (where transfer_is_future), 0)::numeric(14, 2) as transfer_future,
      coalesce(sum(line_father_profit) filter (where cost_price_unit is not null), 0)::numeric(14, 2) as father_profit_total,
      coalesce(sum(line_father_profit) filter (where cost_price_unit is not null and transfer_paid), 0)::numeric(14, 2) as father_profit_received,
      count(*) filter (where cost_price_unit is null)::bigint as father_profit_missing_items,
      count(*) filter (where cost_price_unit is null and transfer_paid)::bigint as father_profit_missing_received_items
    from filtered_items
  ),
  stock_by_product as (
    select p.id, p.cost_price, coalesce(sum(sb.quantity) filter (where sb.variant_active), 0)::integer as quantity
    from public.products p
    left join public.stock_balances sb on sb.product_id = p.id
    where p.active
    group by p.id, p.cost_price
  ),
  stock_totals as (
    select
      coalesce(sum(quantity::numeric * cost_price) filter (where cost_price is not null and quantity > 0), 0)::numeric(14, 2) as stock_cost_total,
      count(*) filter (where quantity > 0 and cost_price is null)::bigint as stock_cost_missing_products
    from stock_by_product
  )
  select totals.*, stock_totals.* from totals cross join stock_totals;
$$;

revoke all on function public.consultas_financial_summary(date, date, uuid, uuid, text, uuid, uuid, boolean, boolean, text) from public;
grant execute on function public.consultas_financial_summary(date, date, uuid, uuid, text, uuid, uuid, boolean, boolean, text) to authenticated;

notify pgrst, 'reload schema';
