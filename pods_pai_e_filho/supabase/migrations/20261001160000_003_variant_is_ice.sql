-- Ice is a boolean flag on flavors, kept separate from the stored name.

alter table public.product_variants
  add column if not exists is_ice boolean not null default false;

alter table public.product_variants
  drop constraint if exists product_variants_name_unique;

alter table public.product_variants
  drop constraint if exists product_variants_name_ice_unique;

alter table public.product_variants
  add constraint product_variants_name_ice_unique unique (product_id, name, is_ice);

create or replace function public.flavor_display_name(p_name text, p_is_ice boolean)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(p_is_ice, false)
      and coalesce(trim(p_name), '') !~* '(^|[[:space:]])ice$'
      then trim(p_name) || ' Ice'
    else p_name
  end;
$$;

revoke all on function public.flavor_display_name(text, boolean) from public;
grant execute on function public.flavor_display_name(text, boolean) to authenticated;

create or replace function public.snapshot_sale_item_variant_name()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
  v_ice boolean;
begin
  select name, is_ice into v_name, v_ice
  from public.product_variants
  where id = new.variant_id;
  if found then
    new.variant_name := public.flavor_display_name(v_name, v_ice);
  end if;
  return new;
end;
$$;

drop trigger if exists sale_items_flavor_snapshot on public.sale_items;
create trigger sale_items_flavor_snapshot
  before insert or update of variant_id, variant_name on public.sale_items
  for each row execute function public.snapshot_sale_item_variant_name();

create or replace view public.stock_balances
with (security_invoker = true) as
select
  v.id as variant_id,
  v.name as variant_name,
  v.active as variant_active,
  p.id as product_id,
  p.name as product_name,
  p.brand,
  p.model,
  p.approximate_puffs,
  p.active as product_active,
  coalesce(sum(m.quantity * mt.direction), 0)::integer as quantity,
  v.is_ice as variant_is_ice
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.stock_movements m on m.variant_id = v.id
left join public.movement_types mt on mt.code = m.movement_type
group by v.id, p.id;

create or replace view public.stock_movement_history
with (security_invoker = true) as
select
  m.id,
  m.product_id,
  m.variant_id,
  m.movement_type,
  mt.name as movement_name,
  mt.direction,
  m.quantity,
  m.movement_date,
  m.sale_id,
  m.notes,
  m.created_by,
  m.created_at,
  p.name as product_name,
  public.flavor_display_name(v.name, v.is_ice) as variant_name,
  pr.full_name as user_name,
  v.is_ice as variant_is_ice
from public.stock_movements m
join public.movement_types mt on mt.code = m.movement_type
join public.products p on p.id = m.product_id
join public.product_variants v on v.id = m.variant_id
left join public.profiles pr on pr.id = m.created_by;

create or replace view public.stock_divergences
with (security_invoker = true) as
select distinct on (l.variant_id)
  l.variant_id,
  l.product_id,
  sb.product_name,
  sb.variant_name,
  sb.quantity as system_quantity,
  l.physical_quantity,
  (l.physical_quantity - sb.quantity) as difference,
  c.counted_at,
  c.id as stock_count_id,
  sb.variant_is_ice
from public.stock_count_lines l
join public.stock_counts c on c.id = l.stock_count_id
join public.stock_balances sb on sb.variant_id = l.variant_id
order by l.variant_id, c.counted_at desc;

create or replace view public.sales_overview
with (security_invoker = true) as
select
  s.id,
  s.sale_date,
  s.customer_id,
  s.customer_name,
  s.customer_type_id,
  s.customer_type_name,
  s.payment_status_id,
  s.is_credit,
  s.notes,
  s.total_amount,
  s.transfer_amount,
  s.profit_amount,
  s.transfer_paid,
  s.transfer_paid_at,
  s.transfer_id,
  s.cancelled_at,
  s.cancelled_by,
  s.cancel_reason,
  s.created_by,
  s.created_at,
  ps.code as payment_status_code,
  ps.name as payment_status_name,
  ps.counts_as_received,
  ps.counts_as_receivable,
  ps.is_terminal,
  (s.cancelled_at is null and not ps.is_terminal) as is_valid,
  (
    s.cancelled_at is null
    and not ps.is_terminal
    and not s.transfer_paid
    and (ps.counts_as_received or s.is_credit)
  ) as transfer_due_now,
  (
    s.cancelled_at is null
    and not ps.is_terminal
    and not s.transfer_paid
    and ps.counts_as_receivable
    and not ps.counts_as_received
    and not s.is_credit
  ) as transfer_is_future,
  coalesce((select sum(si.quantity) from public.sale_items si where si.sale_id = s.id), 0)::integer as quantity,
  coalesce((
    select string_agg(si.product_name || ' · ' || si.variant_name, ', ' order by si.created_at)
    from public.sale_items si
    where si.sale_id = s.id
  ), '') as items_label,
  (
    select si.product_id from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as product_id,
  (
    select si.product_name from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as product_name,
  (
    select si.variant_id from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as variant_id,
  (
    select si.variant_name from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as variant_name,
  (
    select si.unit_price from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as unit_price,
  (
    select si.unit_transfer from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as unit_transfer,
  (
    select si.unit_profit from public.sale_items si
    where si.sale_id = s.id order by si.created_at limit 1
  ) as unit_profit,
  (
    select v.is_ice
    from public.sale_items si
    join public.product_variants v on v.id = si.variant_id
    where si.sale_id = s.id
    order by si.created_at
    limit 1
  ) as variant_is_ice
from public.sales s
join public.payment_statuses ps on ps.id = s.payment_status_id;

drop function if exists public.sales_report(date, date, uuid, uuid, text, uuid, uuid, boolean);

create or replace function public.sales_report(
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
returns jsonb
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
      and (
        p_product_id is null
        or exists (
          select 1 from public.sale_items si
          where si.sale_id = s.id and si.product_id = p_product_id
        )
      )
      and (
        p_is_ice is null
        or exists (
          select 1
          from public.sale_items si
          join public.product_variants v on v.id = si.variant_id
          where si.sale_id = s.id and v.is_ice = p_is_ice
        )
      )
      and (
        nullif(trim(coalesce(p_flavor, '')), '') is null
        or exists (
          select 1
          from public.sale_items si
          left join public.product_variants v on v.id = si.variant_id
          where si.sale_id = s.id
            and (
              si.variant_name ilike '%' || trim(p_flavor) || '%'
              or public.flavor_display_name(v.name, v.is_ice) ilike '%' || trim(p_flavor) || '%'
              or (v.is_ice and lower(trim(p_flavor)) = 'ice')
              or (
                v.is_ice
                and lower(trim(p_flavor)) ~* '[[:space:]]ice$'
                and v.name ilike '%' || regexp_replace(trim(p_flavor), '[[:space:]]+ice$', '', 'i') || '%'
              )
            )
        )
      )
  ),
  filtered_items as (
    select
      si.product_id,
      si.quantity,
      si.line_total,
      si.line_transfer,
      si.line_profit,
      fs.customer_type_id,
      fs.customer_type_name,
      fs.payment_status_id,
      fs.payment_status_name
    from public.sale_items si
    join filtered_sales fs on fs.id = si.sale_id
    where (p_product_id is null or si.product_id = p_product_id)
      and (
        p_is_ice is null
        or exists (
          select 1 from public.product_variants v
          where v.id = si.variant_id and v.is_ice = p_is_ice
        )
      )
  )
  select jsonb_build_object(
    'by_customer_type', coalesce((
      select jsonb_agg(row_data order by sort_order)
      from (
        select
          ct.sort_order,
          jsonb_build_object(
            'name', ct.name,
            'quantity', coalesce(sum(fi.quantity), 0),
            'revenue', coalesce(sum(fi.line_total), 0)::text,
            'transfer', coalesce(sum(fi.line_transfer), 0)::text,
            'profit', coalesce(sum(fi.line_profit), 0)::text
          ) as row_data
        from public.customer_types ct
        left join filtered_items fi on fi.customer_type_id = ct.id
        where ct.active
        group by ct.id, ct.name, ct.sort_order
      ) typed
    ), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_agg(row_data order by sort_order)
      from (
        select
          ps.sort_order,
          jsonb_build_object(
            'name', ps.name,
            'quantity', coalesce(sum(fi.quantity), 0),
            'revenue', coalesce(sum(fi.line_total), 0)::text,
            'transfer', coalesce(sum(fi.line_transfer), 0)::text,
            'profit', coalesce(sum(fi.line_profit), 0)::text
          ) as row_data
        from public.payment_statuses ps
        left join filtered_items fi on fi.payment_status_id = ps.id
        where ps.active and not ps.is_terminal
        group by ps.id, ps.name, ps.sort_order
      ) statuses
    ), '[]'::jsonb),
    'by_product', coalesce((
      select jsonb_agg(row_data order by product_name)
      from (
        select
          p.name as product_name,
          jsonb_build_object(
            'name', p.name,
            'quantity', coalesce(sum(fi.quantity), 0),
            'revenue', coalesce(sum(fi.line_total), 0)::text,
            'transfer', coalesce(sum(fi.line_transfer), 0)::text,
            'profit', coalesce(sum(fi.line_profit), 0)::text,
            'stock', coalesce((
              select sum(sb.quantity)::integer
              from public.stock_balances sb
              where sb.product_id = p.id
                and (p_is_ice is null or sb.variant_is_ice = p_is_ice)
            ), 0)
          ) as row_data
        from public.products p
        left join filtered_items fi on fi.product_id = p.id
        where p.active
          and (p_product_id is null or p.id = p_product_id)
        group by p.id, p.name
      ) products_report
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.sales_report(date, date, uuid, uuid, text, uuid, uuid, boolean, boolean, text) from public;
grant execute on function public.sales_report(date, date, uuid, uuid, text, uuid, uuid, boolean, boolean, text) to authenticated;

notify pgrst, 'reload schema';
