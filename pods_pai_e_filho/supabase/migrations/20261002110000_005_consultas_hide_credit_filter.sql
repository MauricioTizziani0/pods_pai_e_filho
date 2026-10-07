-- The CONSULTAS summary still uses the internal transfer flags derived from
-- is_credit, but must not expose a filter that lets this role segment sales by it.
drop function if exists public.consultas_financial_summary(
  date, date, uuid, uuid, text, uuid, uuid, boolean, boolean, text
);

create function public.consultas_financial_summary(
  p_from date default null,
  p_to date default null,
  p_product_id uuid default null,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_type_id uuid default null,
  p_payment_status_id uuid default null,
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

revoke all on function public.consultas_financial_summary(date, date, uuid, uuid, text, uuid, uuid, boolean, text) from public;
grant execute on function public.consultas_financial_summary(date, date, uuid, uuid, text, uuid, uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
