-- Pods - Pai e Filho
-- Cole este script no SQL Editor do Supabase e execute uma única vez.
--
-- Glossário
--   is_credit          = venda fiada
--   transfer_amount    = repasse total ao pai
--   transfer_paid      = repasse já enviado
--   father_transfer    = repasse unitário ao pai
--   counts_as_received = status Recebido
--
-- A enviar ao pai agora =
--   repasse ainda não pago
--   AND venda válida
--   AND (pagamento recebido OR fiado)
--
-- Repasse futuro =
--   a receber AND não fiada AND repasse ainda não pago
--
-- Lucro unitário = preço de venda - repasse unitário.
-- O lucro não é digitado: colunas geradas e constraints impedem divergência.
-- O estoque é a soma das movimentações, não um saldo editável.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis e papéis
-- ---------------------------------------------------------------------------

create table public.roles (
  code text primary key,
  name text not null,
  can_write boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.roles (code, name, can_write) values
  ('admin', 'Administrador', true),
  ('viewer', 'Consulta', false);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text,
  role_code text not null default 'viewer' references public.roles (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

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
    v_role := 'viewer';
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role_code = 'admin' and new.role_code is distinct from 'admin' then
    if (
      select count(*)
      from public.profiles
      where role_code = 'admin' and id <> old.id
    ) = 0 then
      raise exception 'Deve existir ao menos um administrador';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_last_admin
  before update on public.profiles
  for each row execute function public.protect_last_admin();

create or replace function public.has_write_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.code = p.role_code
    where p.id = auth.uid()
      and r.can_write
  );
$$;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

create table public.customer_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_types_updated_at
  before update on public.customer_types
  for each row execute function public.set_updated_at();

create table public.payment_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  counts_as_received boolean not null default false,
  counts_as_receivable boolean not null default false,
  is_terminal boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_statuses_flags_exclusive
    check (not (counts_as_received and counts_as_receivable))
);

create trigger payment_statuses_updated_at
  before update on public.payment_statuses
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default '',
  model text not null default '',
  approximate_puffs integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_puffs_non_negative check (approximate_puffs is null or approximate_puffs >= 0)
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_name_unique unique (product_id, name)
);

create trigger product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  customer_type_id uuid references public.customer_types (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create index customers_name_idx on public.customers (name);

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  customer_type_id uuid not null references public.customer_types (id) on delete restrict,
  sale_price numeric(14, 2) not null,
  father_transfer numeric(14, 2) not null,
  unit_profit numeric(14, 2) generated always as (sale_price - father_transfer) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_rules_non_negative check (sale_price >= 0 and father_transfer >= 0),
  constraint price_rules_profit_consistent check (sale_price >= father_transfer)
);

create unique index price_rules_active_unique
  on public.price_rules (product_id, customer_type_id)
  where active;

create trigger price_rules_updated_at
  before update on public.price_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------------

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text not null,
  customer_type_id uuid not null references public.customer_types (id) on delete restrict,
  customer_type_name text not null,
  payment_status_id uuid not null references public.payment_statuses (id) on delete restrict,
  is_credit boolean not null default false,
  notes text,
  total_amount numeric(14, 2) not null default 0,
  transfer_amount numeric(14, 2) not null default 0,
  profit_amount numeric(14, 2) not null default 0,
  transfer_paid boolean not null default false,
  transfer_paid_at timestamptz,
  transfer_paid_by uuid references public.profiles (id) on delete set null,
  transfer_id uuid,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_amounts_non_negative
    check (total_amount >= 0 and transfer_amount >= 0 and profit_amount >= 0),
  constraint sales_profit_equation
    check (profit_amount = total_amount - transfer_amount)
);

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

create index sales_sale_date_idx on public.sales (sale_date desc);
create index sales_payment_status_idx on public.sales (payment_status_id);
create index sales_customer_idx on public.sales (customer_id);
create index sales_open_transfer_idx on public.sales (transfer_paid, is_credit) where cancelled_at is null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  variant_name text not null,
  price_rule_id uuid references public.price_rules (id) on delete set null,
  quantity integer not null,
  unit_price numeric(14, 2) not null,
  unit_transfer numeric(14, 2) not null,
  unit_profit numeric(14, 2) generated always as (unit_price - unit_transfer) stored,
  line_total numeric(14, 2) generated always as ((quantity::numeric * unit_price)::numeric(14, 2)) stored,
  line_transfer numeric(14, 2) generated always as ((quantity::numeric * unit_transfer)::numeric(14, 2)) stored,
  line_profit numeric(14, 2) generated always as ((quantity::numeric * (unit_price - unit_transfer))::numeric(14, 2)) stored,
  created_at timestamptz not null default now(),
  constraint sale_items_quantity_positive check (quantity > 0),
  constraint sale_items_prices_non_negative check (unit_price >= 0 and unit_transfer >= 0),
  constraint sale_items_profit_consistent check (unit_price >= unit_transfer)
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);
create index sale_items_variant_idx on public.sale_items (variant_id);

create or replace function public.sync_sale_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale uuid := coalesce(new.sale_id, old.sale_id);
begin
  update public.sales s
  set
    total_amount = coalesce((select sum(line_total) from public.sale_items where sale_id = v_sale), 0),
    transfer_amount = coalesce((select sum(line_transfer) from public.sale_items where sale_id = v_sale), 0),
    profit_amount = coalesce((select sum(line_profit) from public.sale_items where sale_id = v_sale), 0)
  where s.id = v_sale;
  return null;
end;
$$;

create trigger sale_items_sync_totals
  after insert or update or delete on public.sale_items
  for each row execute function public.sync_sale_totals();

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  paid_at timestamptz not null default now(),
  paid_by uuid references public.profiles (id) on delete set null,
  notes text,
  total_amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint transfers_amount_positive check (total_amount >= 0)
);

alter table public.sales
  add constraint sales_transfer_fk
  foreign key (transfer_id) references public.transfers (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------------------

create table public.movement_types (
  code text primary key,
  name text not null,
  direction smallint not null,
  manual boolean not null default false,
  constraint movement_types_direction check (direction in (-1, 1))
);

insert into public.movement_types (code, name, direction, manual) values
  ('ENTRADA', 'Entrada', 1, true),
  ('VENDA', 'Venda', -1, false),
  ('AJUSTE_ENTRADA', 'Ajuste de entrada', 1, true),
  ('AJUSTE_SAIDA', 'Ajuste de saída', -1, true),
  ('CANCELAMENTO_VENDA', 'Cancelamento de venda', 1, false),
  ('ESTORNO_EDICAO', 'Estorno por edição', 1, false);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  movement_type text not null references public.movement_types (code),
  quantity integer not null,
  movement_date date not null default current_date,
  sale_id uuid references public.sales (id) on delete restrict,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_positive check (quantity > 0)
);

create index stock_movements_variant_idx on public.stock_movements (variant_id);
create index stock_movements_sale_idx on public.stock_movements (sale_id);
create index stock_movements_date_idx on public.stock_movements (movement_date desc);

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  notes text,
  counted_at timestamptz not null default now(),
  counted_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz,
  applied_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.stock_count_lines (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references public.stock_counts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  system_quantity integer not null,
  physical_quantity integer not null,
  difference integer generated always as (physical_quantity - system_quantity) stored,
  constraint stock_count_lines_unique unique (stock_count_id, variant_id),
  constraint stock_count_lines_physical_non_negative check (physical_quantity >= 0)
);

-- ---------------------------------------------------------------------------
-- Auditoria e configurações
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (key, value) values
  ('low_stock_threshold', '5'::jsonb);

-- ---------------------------------------------------------------------------
-- Funções internas
-- ---------------------------------------------------------------------------

create or replace function public.write_audit(
  p_user uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (p_user, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.write_stock_movement(
  p_product_id uuid,
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_date date,
  p_sale_id uuid,
  p_notes text,
  p_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_direction smallint;
  v_stock integer;
  v_label text;
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade da movimentação deve ser positiva';
  end if;

  select direction into v_direction
  from public.movement_types
  where code = p_type;

  if v_direction is null then
    raise exception 'Tipo de movimentação inválido';
  end if;

  perform 1 from public.product_variants where id = p_variant_id for update;

  if v_direction < 0 then
    select coalesce(sum(m.quantity * mt.direction), 0)::integer
      into v_stock
    from public.stock_movements m
    join public.movement_types mt on mt.code = m.movement_type
    where m.variant_id = p_variant_id;

    if coalesce(v_stock, 0) < p_quantity then
      select p.name || ' · ' || v.name into v_label
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = p_variant_id;

      raise exception 'Estoque insuficiente para %. Disponível: %', v_label, coalesce(v_stock, 0);
    end if;
  end if;

  insert into public.stock_movements (
    product_id, variant_id, movement_type, quantity, movement_date, sale_id, notes, created_by
  ) values (
    p_product_id, p_variant_id, p_type, p_quantity, coalesce(p_date, current_date), p_sale_id, p_notes, p_user
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

create view public.stock_balances
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
  coalesce(sum(m.quantity * mt.direction), 0)::integer as quantity
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.stock_movements m on m.variant_id = v.id
left join public.movement_types mt on mt.code = m.movement_type
group by v.id, p.id;

create view public.sales_overview
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
  ) as unit_profit
from public.sales s
join public.payment_statuses ps on ps.id = s.payment_status_id;

create view public.stock_movement_history
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
  v.name as variant_name,
  pr.full_name as user_name
from public.stock_movements m
join public.movement_types mt on mt.code = m.movement_type
join public.products p on p.id = m.product_id
join public.product_variants v on v.id = m.variant_id
left join public.profiles pr on pr.id = m.created_by;

create view public.stock_divergences
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
  c.id as stock_count_id
from public.stock_count_lines l
join public.stock_counts c on c.id = l.stock_count_id
join public.stock_balances sb on sb.variant_id = l.variant_id
order by l.variant_id, c.counted_at desc;

-- ---------------------------------------------------------------------------
-- Operações transacionais
-- ---------------------------------------------------------------------------

create or replace function public.create_sale(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale_id uuid := gen_random_uuid();
  v_item jsonb;
  v_customer_type_id uuid;
  v_payment_status_id uuid;
  v_counts_as_received boolean;
  v_is_credit boolean;
  v_customer_id uuid;
  v_customer_name text;
  v_sale_date date;
  v_notes text;
  v_type_name text;
  v_variant_id uuid;
  v_qty integer;
  v_product_id uuid;
  v_product_name text;
  v_variant_name text;
  v_price numeric(14, 2);
  v_transfer numeric(14, 2);
  v_rule_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para registrar vendas';
  end if;

  v_sale_date := coalesce(nullif(payload ->> 'sale_date', '')::date, current_date);
  v_customer_type_id := nullif(payload ->> 'customer_type_id', '')::uuid;
  v_payment_status_id := nullif(payload ->> 'payment_status_id', '')::uuid;
  v_is_credit := coalesce((payload ->> 'is_credit')::boolean, false);
  v_customer_id := nullif(payload ->> 'customer_id', '')::uuid;
  v_customer_name := nullif(trim(coalesce(payload ->> 'customer_name', '')), '');
  v_notes := nullif(payload ->> 'notes', '');

  if v_customer_name is null and v_customer_id is not null then
    select name into v_customer_name from public.customers where id = v_customer_id;
  end if;

  if v_customer_name is null then
    raise exception 'Informe o nome do cliente';
  end if;

  select counts_as_received into v_counts_as_received
  from public.payment_statuses
  where id = v_payment_status_id and active and not is_terminal;

  if v_counts_as_received is null then
    raise exception 'Status de pagamento inválido';
  end if;

  if v_counts_as_received then
    v_is_credit := false;
  end if;

  select name into v_type_name
  from public.customer_types
  where id = v_customer_type_id and active;

  if v_type_name is null then
    raise exception 'Tipo de cliente inválido';
  end if;

  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Informe ao menos um item';
  end if;

  insert into public.sales (
    id, sale_date, customer_id, customer_name, customer_type_id, customer_type_name,
    payment_status_id, is_credit, notes, created_by
  ) values (
    v_sale_id, v_sale_date, v_customer_id, v_customer_name, v_customer_type_id, v_type_name,
    v_payment_status_id, v_is_credit, v_notes, v_user
  );

  for v_item in select value from jsonb_array_elements(payload -> 'items')
  loop
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select v.product_id, v.name, p.name
      into v_product_id, v_variant_name, v_product_name
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = v_variant_id and v.active and p.active;

    if v_product_id is null then
      raise exception 'Produto ou sabor inválido';
    end if;

    select id, sale_price, father_transfer
      into v_rule_id, v_price, v_transfer
    from public.price_rules
    where product_id = v_product_id
      and customer_type_id = v_customer_type_id
      and active;

    if v_price is null then
      raise exception 'Não há preço configurado para este produto e tipo de cliente';
    end if;

    insert into public.sale_items (
      sale_id, product_id, product_name, variant_id, variant_name,
      price_rule_id, quantity, unit_price, unit_transfer
    ) values (
      v_sale_id, v_product_id, v_product_name, v_variant_id, v_variant_name,
      v_rule_id, v_qty, v_price, v_transfer
    );

    perform public.write_stock_movement(
      v_product_id, v_variant_id, 'VENDA', v_qty, v_sale_date, v_sale_id,
      'Baixa automática da venda', v_user
    );
  end loop;

  perform public.write_audit(v_user, 'sale.created', 'sales', v_sale_id, payload);
  return v_sale_id;
end;
$$;

create or replace function public.update_sale(p_sale_id uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_type uuid;
  v_type_name text;
  v_status uuid;
  v_status_received boolean;
  v_is_credit boolean;
  v_customer_id uuid;
  v_customer_name text;
  v_notes text;
  v_sale_date date;
  v_old_variant uuid;
  v_old_qty integer;
  v_old_price numeric(14, 2);
  v_old_transfer numeric(14, 2);
  v_old_product uuid;
  v_new_variant uuid;
  v_new_qty integer;
  v_product_id uuid;
  v_product_name text;
  v_variant_name text;
  v_price numeric(14, 2);
  v_transfer numeric(14, 2);
  v_rule_id uuid;
  v_item_count integer;
  v_items_changed boolean := false;
  v_type_changed boolean := false;
  v_existing public.sale_items%rowtype;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para editar vendas';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada';
  end if;
  if v_sale.cancelled_at is not null then
    raise exception 'Venda cancelada não pode ser editada';
  end if;

  select count(*) into v_item_count from public.sale_items where sale_id = p_sale_id;
  if v_item_count <> 1 then
    raise exception 'Edição disponível para vendas com um item';
  end if;

  select * into v_existing from public.sale_items where sale_id = p_sale_id limit 1;

  v_type := coalesce(nullif(payload ->> 'customer_type_id', '')::uuid, v_sale.customer_type_id);
  v_status := coalesce(nullif(payload ->> 'payment_status_id', '')::uuid, v_sale.payment_status_id);
  v_customer_id := case
    when payload ? 'customer_id' then nullif(payload ->> 'customer_id', '')::uuid
    else v_sale.customer_id
  end;
  v_customer_name := coalesce(nullif(trim(coalesce(payload ->> 'customer_name', '')), ''), v_sale.customer_name);
  v_notes := case
    when payload ? 'notes' then nullif(payload ->> 'notes', '')
    else v_sale.notes
  end;
  v_sale_date := coalesce(nullif(payload ->> 'sale_date', '')::date, v_sale.sale_date);
  v_new_variant := coalesce(nullif(payload ->> 'variant_id', '')::uuid, v_existing.variant_id);
  v_new_qty := coalesce((payload ->> 'quantity')::integer, v_existing.quantity);

  if v_new_qty is null or v_new_qty <= 0 then
    raise exception 'Quantidade inválida';
  end if;

  select name into v_type_name from public.customer_types where id = v_type and active;
  if v_type_name is null then
    raise exception 'Tipo de cliente inválido';
  end if;

  select counts_as_received into v_status_received
  from public.payment_statuses
  where id = v_status and active and not is_terminal;

  if v_status_received is null then
    raise exception 'Status de pagamento inválido';
  end if;

  if v_status_received then
    -- Mantém o histórico de fiado quando a venda já era fiada e passa a recebida.
    v_is_credit := v_sale.is_credit;
  else
    v_is_credit := coalesce((payload ->> 'is_credit')::boolean, v_sale.is_credit);
  end if;

  v_type_changed := v_type is distinct from v_sale.customer_type_id;
  v_items_changed := v_new_variant is distinct from v_existing.variant_id
    or v_new_qty is distinct from v_existing.quantity
    or v_type_changed;

  if v_sale.transfer_paid and (v_items_changed or v_is_credit is distinct from v_sale.is_credit) then
    raise exception 'O repasse desta venda já foi pago. Não é possível alterar produto, quantidade, tipo ou fiado.';
  end if;

  if v_items_changed then
    v_old_variant := v_existing.variant_id;
    v_old_qty := v_existing.quantity;
    v_old_price := v_existing.unit_price;
    v_old_transfer := v_existing.unit_transfer;
    v_old_product := v_existing.product_id;

    if v_new_variant is distinct from v_old_variant or v_new_qty is distinct from v_old_qty then
      perform public.write_stock_movement(
        v_old_product, v_old_variant, 'ESTORNO_EDICAO', v_old_qty, current_date, p_sale_id,
        'Estorno por edição da venda', v_user
      );
    end if;

    select v.product_id, v.name, p.name
      into v_product_id, v_variant_name, v_product_name
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = v_new_variant and v.active and p.active;

    if v_product_id is null then
      raise exception 'Produto ou sabor inválido';
    end if;

    if v_new_variant = v_old_variant and not v_type_changed then
      v_price := v_old_price;
      v_transfer := v_old_transfer;
      v_rule_id := v_existing.price_rule_id;
    else
      select id, sale_price, father_transfer
        into v_rule_id, v_price, v_transfer
      from public.price_rules
      where product_id = v_product_id
        and customer_type_id = v_type
        and active;

      if v_price is null then
        raise exception 'Não há preço configurado para este produto e tipo de cliente';
      end if;
    end if;

    update public.sale_items
    set
      product_id = v_product_id,
      product_name = v_product_name,
      variant_id = v_new_variant,
      variant_name = v_variant_name,
      price_rule_id = v_rule_id,
      quantity = v_new_qty,
      unit_price = v_price,
      unit_transfer = v_transfer
    where id = v_existing.id;

    if v_new_variant is distinct from v_old_variant or v_new_qty is distinct from v_old_qty then
      perform public.write_stock_movement(
        v_product_id, v_new_variant, 'VENDA', v_new_qty, v_sale_date, p_sale_id,
        'Baixa após edição da venda', v_user
      );
    end if;
  end if;

  update public.sales
  set
    sale_date = v_sale_date,
    customer_id = v_customer_id,
    customer_name = v_customer_name,
    customer_type_id = v_type,
    customer_type_name = v_type_name,
    payment_status_id = v_status,
    is_credit = v_is_credit,
    notes = v_notes
  where id = p_sale_id;

  update public.stock_movements
  set movement_date = v_sale_date
  where sale_id = p_sale_id and movement_type = 'VENDA';

  perform public.write_audit(v_user, 'sale.updated', 'sales', p_sale_id, payload);
end;
$$;

create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_item public.sale_items%rowtype;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para cancelar vendas';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada';
  end if;
  if v_sale.cancelled_at is not null then
    raise exception 'Venda já cancelada';
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale_id
  loop
    perform public.write_stock_movement(
      v_item.product_id, v_item.variant_id, 'CANCELAMENTO_VENDA', v_item.quantity,
      current_date, p_sale_id, 'Devolução por cancelamento', v_user
    );
  end loop;

  update public.sales
  set
    cancelled_at = now(),
    cancelled_by = v_user,
    cancel_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_sale_id;

  perform public.write_audit(
    v_user, 'sale.cancelled', 'sales', p_sale_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

create or replace function public.confirm_receipt(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_status uuid;
  v_already boolean;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para confirmar recebimento';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venda não encontrada';
  end if;
  if v_sale.cancelled_at is not null then
    raise exception 'Venda cancelada';
  end if;

  select counts_as_received into v_already
  from public.payment_statuses
  where id = v_sale.payment_status_id;

  if v_already then
    raise exception 'Esta venda já está recebida';
  end if;

  select id into v_status
  from public.payment_statuses
  where code = 'recebido' and active;

  if v_status is null then
    raise exception 'Status Recebido não está disponível';
  end if;

  update public.sales
  set payment_status_id = v_status
  where id = p_sale_id;

  perform public.write_audit(v_user, 'sale.payment_confirmed', 'sales', p_sale_id, '{}'::jsonb);
end;
$$;

create or replace function public.confirm_transfers(p_sale_ids uuid[], p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales_overview%rowtype;
  v_transfer_id uuid;
  v_total numeric(14, 2) := 0;
  v_count integer := 0;
  v_locked integer := 0;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para confirmar repasses';
  end if;

  if p_sale_ids is null or cardinality(p_sale_ids) = 0 then
    raise exception 'Selecione ao menos uma venda';
  end if;

  v_locked := 0;
  for v_id in
    select id from public.sales where id = any (p_sale_ids) for update
  loop
    v_locked := v_locked + 1;
  end loop;

  if v_locked <> cardinality(p_sale_ids) then
    raise exception 'Uma ou mais vendas não foram encontradas';
  end if;

  for v_sale in
    select * from public.sales_overview
    where id = any (p_sale_ids)
  loop
    if not v_sale.transfer_due_now then
      raise exception 'A venda de % não está em "A enviar ao pai agora"', v_sale.customer_name;
    end if;
    v_total := v_total + v_sale.transfer_amount;
    v_count := v_count + 1;
  end loop;

  if v_count <> cardinality(p_sale_ids) then
    raise exception 'Uma ou mais vendas não foram encontradas';
  end if;

  insert into public.transfers (paid_by, notes, total_amount)
  values (v_user, nullif(trim(coalesce(p_notes, '')), ''), v_total)
  returning id into v_transfer_id;

  update public.sales
  set
    transfer_paid = true,
    transfer_paid_at = now(),
    transfer_paid_by = v_user,
    transfer_id = v_transfer_id
  where id = any (p_sale_ids);

  perform public.write_audit(
    v_user, 'transfer.confirmed', 'transfers', v_transfer_id,
    jsonb_build_object('sale_ids', p_sale_ids, 'total', v_total, 'notes', p_notes)
  );

  for v_id in
    select unnest(p_sale_ids)
  loop
    perform public.write_audit(
      v_user, 'transfer.confirmed', 'sales', v_id,
      jsonb_build_object('transfer_id', v_transfer_id)
    );
  end loop;

  return v_transfer_id;
end;
$$;

create or replace function public.register_stock_movement(
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_date date,
  p_notes text
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
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para movimentar estoque';
  end if;

  select manual into v_manual from public.movement_types where code = p_type;
  if v_manual is distinct from true then
    raise exception 'Use apenas entrada ou ajuste manual nesta operação';
  end if;

  select product_id into v_product
  from public.product_variants
  where id = p_variant_id and active;

  if v_product is null then
    raise exception 'Sabor inválido';
  end if;

  v_id := public.write_stock_movement(
    v_product, p_variant_id, p_type, p_quantity, p_date, null, nullif(trim(coalesce(p_notes, '')), ''), v_user
  );

  perform public.write_audit(
    v_user, 'stock.movement', 'stock_movements', v_id,
    jsonb_build_object('variant_id', p_variant_id, 'type', p_type, 'quantity', p_quantity, 'notes', p_notes)
  );

  return v_id;
end;
$$;

create or replace function public.register_stock_count(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count_id uuid := gen_random_uuid();
  v_line jsonb;
  v_variant uuid;
  v_physical integer;
  v_product uuid;
  v_system integer;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para conferir estoque';
  end if;

  if jsonb_typeof(payload -> 'lines') <> 'array' or jsonb_array_length(payload -> 'lines') = 0 then
    raise exception 'Informe as quantidades contadas';
  end if;

  insert into public.stock_counts (id, notes, counted_by)
  values (v_count_id, nullif(payload ->> 'notes', ''), v_user);

  for v_line in select value from jsonb_array_elements(payload -> 'lines')
  loop
    v_variant := nullif(v_line ->> 'variant_id', '')::uuid;
    v_physical := (v_line ->> 'physical_quantity')::integer;

    if v_physical is null or v_physical < 0 then
      raise exception 'Quantidade física inválida';
    end if;

    select product_id into v_product from public.product_variants where id = v_variant;
    if v_product is null then
      raise exception 'Sabor inválido na conferência';
    end if;

    select coalesce(sum(m.quantity * mt.direction), 0)::integer
      into v_system
    from public.stock_movements m
    join public.movement_types mt on mt.code = m.movement_type
    where m.variant_id = v_variant;

    insert into public.stock_count_lines (
      stock_count_id, product_id, variant_id, system_quantity, physical_quantity
    ) values (
      v_count_id, v_product, v_variant, coalesce(v_system, 0), v_physical
    );
  end loop;

  perform public.write_audit(v_user, 'stock.count', 'stock_counts', v_count_id, payload);
  return v_count_id;
end;
$$;

create or replace function public.apply_stock_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_applied timestamptz;
  v_line public.stock_count_lines%rowtype;
  v_current integer;
  v_diff integer;
begin
  if v_user is null then
    raise exception 'Não autenticado';
  end if;
  if not public.has_write_access() then
    raise exception 'Sem permissão para ajustar estoque';
  end if;

  select applied_at into v_applied
  from public.stock_counts
  where id = p_count_id
  for update;

  if v_applied is null and not found then
    raise exception 'Conferência não encontrada';
  end if;
  if v_applied is not null then
    raise exception 'Esta conferência já foi aplicada';
  end if;

  for v_line in select * from public.stock_count_lines where stock_count_id = p_count_id
  loop
    select coalesce(sum(m.quantity * mt.direction), 0)::integer
      into v_current
    from public.stock_movements m
    join public.movement_types mt on mt.code = m.movement_type
    where m.variant_id = v_line.variant_id;

    v_diff := v_line.physical_quantity - coalesce(v_current, 0);

    if v_diff > 0 then
      perform public.write_stock_movement(
        v_line.product_id, v_line.variant_id, 'AJUSTE_ENTRADA', v_diff, current_date, null,
        'Ajuste da conferência de estoque', v_user
      );
    elsif v_diff < 0 then
      perform public.write_stock_movement(
        v_line.product_id, v_line.variant_id, 'AJUSTE_SAIDA', abs(v_diff), current_date, null,
        'Ajuste da conferência de estoque', v_user
      );
    end if;
  end loop;

  update public.stock_counts
  set applied_at = now(), applied_by = v_user
  where id = p_count_id;

  perform public.write_audit(
    v_user, 'stock.count_applied', 'stock_counts', p_count_id, '{}'::jsonb
  );
end;
$$;

create or replace function public.dashboard_metrics(p_from date default null, p_to date default null)
returns table (
  money_received numeric,
  receivable numeric,
  profit_received numeric,
  profit_total numeric,
  transfer_from_received numeric,
  transfer_future numeric,
  transfer_due_now numeric,
  transfer_total numeric,
  sales_count bigint,
  units_sold bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(s.total_amount) filter (where s.counts_as_received), 0)::numeric(14, 2),
    coalesce(sum(s.total_amount) filter (where s.counts_as_receivable and not s.counts_as_received), 0)::numeric(14, 2),
    coalesce(sum(s.profit_amount) filter (where s.counts_as_received), 0)::numeric(14, 2),
    coalesce(sum(s.profit_amount), 0)::numeric(14, 2),
    coalesce(sum(s.transfer_amount) filter (where s.counts_as_received), 0)::numeric(14, 2),
    coalesce(sum(s.transfer_amount) filter (where s.transfer_is_future), 0)::numeric(14, 2),
    coalesce(sum(s.transfer_amount) filter (where s.transfer_due_now), 0)::numeric(14, 2),
    coalesce(sum(s.transfer_amount), 0)::numeric(14, 2),
    count(*)::bigint,
    coalesce(sum(s.quantity), 0)::bigint
  from public.sales_overview s
  where s.is_valid
    and (p_from is null or s.sale_date >= p_from)
    and (p_to is null or s.sale_date <= p_to);
$$;

create or replace function public.sales_report(
  p_from date default null,
  p_to date default null,
  p_product_id uuid default null,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_type_id uuid default null,
  p_payment_status_id uuid default null,
  p_is_credit boolean default null
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
    where p_product_id is null or si.product_id = p_product_id
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.customer_types enable row level security;
alter table public.payment_statuses enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.price_rules enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.transfers enable row level security;
alter table public.movement_types enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_lines enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy roles_select on public.roles
  for select to authenticated using (true);

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update on public.profiles
  for update to authenticated
  using (public.has_write_access())
  with check (public.has_write_access());

create policy customer_types_select on public.customer_types
  for select to authenticated using (true);
create policy customer_types_insert on public.customer_types
  for insert to authenticated with check (public.has_write_access());
create policy customer_types_update on public.customer_types
  for update to authenticated
  using (public.has_write_access()) with check (public.has_write_access());

create policy payment_statuses_select on public.payment_statuses
  for select to authenticated using (true);

create policy products_select on public.products
  for select to authenticated using (true);
create policy products_insert on public.products
  for insert to authenticated with check (public.has_write_access());
create policy products_update on public.products
  for update to authenticated
  using (public.has_write_access()) with check (public.has_write_access());

create policy variants_select on public.product_variants
  for select to authenticated using (true);
create policy variants_insert on public.product_variants
  for insert to authenticated with check (public.has_write_access());
create policy variants_update on public.product_variants
  for update to authenticated
  using (public.has_write_access()) with check (public.has_write_access());

create policy customers_select on public.customers
  for select to authenticated using (true);
create policy customers_insert on public.customers
  for insert to authenticated with check (public.has_write_access());
create policy customers_update on public.customers
  for update to authenticated
  using (public.has_write_access()) with check (public.has_write_access());

create policy price_rules_select on public.price_rules
  for select to authenticated using (true);
create policy price_rules_insert on public.price_rules
  for insert to authenticated with check (public.has_write_access());
create policy price_rules_update on public.price_rules
  for update to authenticated
  using (public.has_write_access()) with check (public.has_write_access());

create policy sales_select on public.sales
  for select to authenticated using (true);
create policy sale_items_select on public.sale_items
  for select to authenticated using (true);
create policy transfers_select on public.transfers
  for select to authenticated using (true);
create policy movement_types_select on public.movement_types
  for select to authenticated using (true);
create policy stock_movements_select on public.stock_movements
  for select to authenticated using (true);
create policy stock_counts_select on public.stock_counts
  for select to authenticated using (true);
create policy stock_count_lines_select on public.stock_count_lines
  for select to authenticated using (true);
create policy audit_select on public.audit_logs
  for select to authenticated using (true);

create policy settings_select on public.app_settings
  for select to authenticated using (true);
create policy settings_update on public.app_settings
  for update to authenticated
  using (public.has_write_access()) with check (public.has_write_access());

-- ---------------------------------------------------------------------------
-- Privilégios
-- Escrita de vendas, estoque, repasses e auditoria só pelas funções.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on all tables in schema public to authenticated;

grant insert, update on
  public.products,
  public.product_variants,
  public.customers,
  public.customer_types,
  public.price_rules
to authenticated;

grant update on public.profiles to authenticated;
grant update on public.app_settings to authenticated;

revoke all on function public.write_audit(uuid, text, text, uuid, jsonb) from public;
revoke all on function public.write_stock_movement(uuid, uuid, text, integer, date, uuid, text, uuid) from public;

revoke all on function public.has_write_access() from public;
grant execute on function public.has_write_access() to authenticated;

revoke all on function public.create_sale(jsonb) from public;
grant execute on function public.create_sale(jsonb) to authenticated;

revoke all on function public.update_sale(uuid, jsonb) from public;
grant execute on function public.update_sale(uuid, jsonb) to authenticated;

revoke all on function public.cancel_sale(uuid, text) from public;
grant execute on function public.cancel_sale(uuid, text) to authenticated;

revoke all on function public.confirm_receipt(uuid) from public;
grant execute on function public.confirm_receipt(uuid) to authenticated;

revoke all on function public.confirm_transfers(uuid[], text) from public;
grant execute on function public.confirm_transfers(uuid[], text) to authenticated;

revoke all on function public.register_stock_movement(uuid, text, integer, date, text) from public;
grant execute on function public.register_stock_movement(uuid, text, integer, date, text) to authenticated;

revoke all on function public.register_stock_count(jsonb) from public;
grant execute on function public.register_stock_count(jsonb) to authenticated;

revoke all on function public.apply_stock_count(uuid) from public;
grant execute on function public.apply_stock_count(uuid) to authenticated;

revoke all on function public.dashboard_metrics(date, date) from public;
grant execute on function public.dashboard_metrics(date, date) to authenticated;

revoke all on function public.sales_report(date, date, uuid, uuid, text, uuid, uuid, boolean) from public;
grant execute on function public.sales_report(date, date, uuid, uuid, text, uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed inicial (valores da planilha)
-- ---------------------------------------------------------------------------

insert into public.customer_types (id, code, name, sort_order) values
  ('30000000-0000-4000-8000-000000000001', 'normal', 'Normal', 1),
  ('30000000-0000-4000-8000-000000000002', 'amigo', 'Amigo', 2);

insert into public.payment_statuses (
  id, code, name, counts_as_received, counts_as_receivable, is_terminal, active, sort_order
) values
  ('40000000-0000-4000-8000-000000000001', 'recebido', 'Recebido', true, false, false, true, 1),
  ('40000000-0000-4000-8000-000000000002', 'a_receber', 'A receber', false, true, false, true, 2),
  ('40000000-0000-4000-8000-000000000003', 'parcial', 'Parcialmente recebido', false, true, false, false, 3),
  ('40000000-0000-4000-8000-000000000004', 'cancelado', 'Cancelado', false, false, true, false, 4);

insert into public.products (id, name, brand, model, approximate_puffs) values
  ('10000000-0000-4000-8000-000000000040', 'Pod 40k', 'Genérica', '40k', 40000),
  ('10000000-0000-4000-8000-000000000030', 'Pod 30k', 'Genérica', '30k', 30000);

insert into public.product_variants (id, product_id, name) values
  ('20000000-0000-4000-8000-000000000041', '10000000-0000-4000-8000-000000000040', 'Grape Ice'),
  ('20000000-0000-4000-8000-000000000042', '10000000-0000-4000-8000-000000000040', 'Strawberry'),
  ('20000000-0000-4000-8000-000000000043', '10000000-0000-4000-8000-000000000040', 'Watermelon'),
  ('20000000-0000-4000-8000-000000000044', '10000000-0000-4000-8000-000000000040', 'Blue Razz'),
  ('20000000-0000-4000-8000-000000000031', '10000000-0000-4000-8000-000000000030', 'Padrão');

insert into public.price_rules (id, product_id, customer_type_id, sale_price, father_transfer) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000040', '30000000-0000-4000-8000-000000000001', 150.00, 125.00),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000040', '30000000-0000-4000-8000-000000000002', 130.00, 125.00),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000030', '30000000-0000-4000-8000-000000000001', 140.00, 115.00),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000030', '30000000-0000-4000-8000-000000000002', 120.00, 115.00);

do $$
begin
  if not exists (
    select 1
    from public.price_rules pr
    join public.products p on p.id = pr.product_id
    join public.customer_types ct on ct.id = pr.customer_type_id
    where p.name = 'Pod 40k' and ct.code = 'normal'
      and pr.sale_price = 150 and pr.father_transfer = 125 and pr.unit_profit = 25
  ) then
    raise exception 'Seed de preço do Pod 40k Normal inconsistente';
  end if;

  if not exists (
    select 1
    from public.price_rules pr
    join public.products p on p.id = pr.product_id
    join public.customer_types ct on ct.id = pr.customer_type_id
    where p.name = 'Pod 40k' and ct.code = 'amigo'
      and pr.sale_price = 130 and pr.father_transfer = 125 and pr.unit_profit = 5
  ) then
    raise exception 'Seed de preço do Pod 40k Amigo inconsistente';
  end if;

  if not exists (
    select 1
    from public.price_rules pr
    join public.products p on p.id = pr.product_id
    join public.customer_types ct on ct.id = pr.customer_type_id
    where p.name = 'Pod 30k' and ct.code = 'normal'
      and pr.sale_price = 140 and pr.father_transfer = 115 and pr.unit_profit = 25
  ) then
    raise exception 'Seed de preço do Pod 30k Normal inconsistente';
  end if;

  if not exists (
    select 1
    from public.price_rules pr
    join public.products p on p.id = pr.product_id
    join public.customer_types ct on ct.id = pr.customer_type_id
    where p.name = 'Pod 30k' and ct.code = 'amigo'
      and pr.sale_price = 120 and pr.father_transfer = 115 and pr.unit_profit = 5
  ) then
    raise exception 'Seed de preço do Pod 30k Amigo inconsistente';
  end if;
end $$;

notify pgrst, 'reload schema';
