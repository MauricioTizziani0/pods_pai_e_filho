-- Configurable commercial messages. Inventory still comes only from movements.
begin;

alter table public.products
  add column if not exists promotion_name text,
  add column if not exists promotion_features text[] not null default '{}'::text[],
  add column if not exists display_order integer;

alter table public.products drop constraint if exists products_promotion_name_valid;
alter table public.products add constraint products_promotion_name_valid check (
  promotion_name is null or (
    char_length(promotion_name) <= 160
    and promotion_name !~ '[<>[:cntrl:]]'
  )
);
alter table public.products drop constraint if exists products_display_order_non_negative;
alter table public.products add constraint products_display_order_non_negative
  check (display_order is null or display_order >= 0);

create or replace function public.valid_promotion_features(p_features text[])
returns boolean
language sql
immutable
parallel safe
set search_path = public
as $$
  select p_features is not null
    and cardinality(p_features) <= 20
    and (array_ndims(p_features) is null or array_ndims(p_features) = 1)
    and not exists (
      select 1 from unnest(p_features) feature
      where feature is null or char_length(feature) > 160
        or feature ~ '[<>[:cntrl:]]'
    );
$$;
revoke all on function public.valid_promotion_features(text[]) from public;
grant execute on function public.valid_promotion_features(text[]) to authenticated;

alter table public.products drop constraint if exists products_promotion_features_valid;
alter table public.products add constraint products_promotion_features_valid
  check (public.valid_promotion_features(promotion_features));

-- Reapplication must not run the Administrator-only trigger while seeding.
drop trigger if exists settings_protect_whatsapp_promotion on public.app_settings;
insert into public.app_settings (key, value)
values (
  'whatsapp_promotion',
  jsonb_build_object(
    'header', '📦🔥 PODS DISPONÍVEIS 🔥📦',
    'footer', E'📍 Entrega grátis para Frederico Westphalen\n🔥 Produtos com pronta entrega'
  )
)
on conflict (key) do nothing;

-- Explicit Administrator checks also cover future roles with can_write=true.
create or replace function public.is_whatsapp_promotion_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(p.role_code) = 'admin'
  );
$$;
revoke all on function public.is_whatsapp_promotion_admin() from public;
grant execute on function public.is_whatsapp_promotion_admin() to authenticated;

create or replace function public.protect_product_promotion_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := new.promotion_name is not null
      or cardinality(new.promotion_features) > 0
      or new.display_order is not null;
  else
    v_changed := row(new.promotion_name, new.promotion_features, new.display_order)
      is distinct from row(old.promotion_name, old.promotion_features, old.display_order);
  end if;
  if v_changed and not public.is_whatsapp_promotion_admin() then
    raise exception 'Somente o Administrador pode editar informações para divulgação';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_product_promotion_fields() from public;
drop trigger if exists products_protect_promotion on public.products;
create trigger products_protect_promotion
  before insert or update of promotion_name, promotion_features, display_order on public.products
  for each row execute function public.protect_product_promotion_fields();

create or replace function public.protect_whatsapp_promotion_settings()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_header text;
  v_footer text;
begin
  if tg_op = 'DELETE' then
    if old.key = 'whatsapp_promotion' and not public.is_whatsapp_promotion_admin() then
      raise exception 'Somente o Administrador pode alterar as configurações de divulgação';
    end if;
    return old;
  end if;
  if new.key <> 'whatsapp_promotion' then
    if tg_op = 'UPDATE' and old.key = 'whatsapp_promotion'
      and not public.is_whatsapp_promotion_admin() then
      raise exception 'Somente o Administrador pode alterar as configurações de divulgação';
    end if;
    return new;
  end if;
  if not public.is_whatsapp_promotion_admin() then
    raise exception 'Somente o Administrador pode alterar as configurações de divulgação';
  end if;
  if jsonb_typeof(new.value) <> 'object'
    or jsonb_typeof(new.value -> 'header') is distinct from 'string'
    or jsonb_typeof(new.value -> 'footer') is distinct from 'string' then
    raise exception 'Informe um cabeçalho e um rodapé válidos';
  end if;
  v_header := new.value ->> 'header';
  v_footer := new.value ->> 'footer';
  if nullif(btrim(v_header, E' \t\n\r'), '') is null or char_length(v_header) > 200 then
    raise exception 'O cabeçalho deve ter entre 1 e 200 caracteres';
  end if;
  if char_length(v_footer) > 2000 then
    raise exception 'O rodapé deve ter até 2000 caracteres';
  end if;
  if v_header ~ '[<>]' or v_footer ~ '[<>]'
    or regexp_replace(v_header || v_footer, E'[\n\r\t]', '', 'g') ~ '[[:cntrl:]]' then
    raise exception 'Utilize apenas texto, emojis e quebras de linha, sem HTML, no cabeçalho e no rodapé';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_whatsapp_promotion_settings() from public;
drop trigger if exists settings_protect_whatsapp_promotion on public.app_settings;
create trigger settings_protect_whatsapp_promotion
  before insert or update or delete on public.app_settings
  for each row execute function public.protect_whatsapp_promotion_settings();

create or replace function public.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if row(new.name, new.brand, new.model, new.approximate_puffs, new.active,
         new.promotion_name, new.promotion_features, new.display_order)
     is distinct from row(old.name, old.brand, old.model, old.approximate_puffs, old.active,
                          old.promotion_name, old.promotion_features, old.display_order) then
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

create or replace function public.save_whatsapp_promotion_settings(p_header text, p_footer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_before jsonb;
  v_after jsonb := jsonb_build_object('header', p_header, 'footer', p_footer);
begin
  if v_user is null or not public.is_whatsapp_promotion_admin() then
    raise exception 'Somente o Administrador pode alterar as configurações de divulgação';
  end if;
  select value into v_before from public.app_settings where key = 'whatsapp_promotion' for update;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('whatsapp_promotion', v_after, now(), v_user)
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  perform public.write_audit(v_user, 'promotion.settings_updated', 'app_settings', null,
    jsonb_build_object('key', 'whatsapp_promotion', 'before', v_before, 'after', v_after));
end;
$$;
revoke all on function public.save_whatsapp_promotion_settings(text, text) from public;
grant execute on function public.save_whatsapp_promotion_settings(text, text) to authenticated;

-- STABLE and one SELECT give balances, prices and configuration the same MVCC
-- snapshot. The DTO deliberately omits every financial/internal customer field.
create or replace function public.get_whatsapp_promotion_snapshot()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_snapshot jsonb;
begin
  if auth.uid() is null or not public.is_whatsapp_promotion_admin() then
    raise exception 'A divulgação está disponível apenas para o Administrador';
  end if;
  with active_balances as (
    select sb.variant_id, sb.product_id, sb.variant_name, sb.variant_is_ice, sb.quantity
    from public.stock_balances sb
    where sb.product_active and sb.variant_active
  ), available_products as (
    select p.id, p.name, p.promotion_name, p.approximate_puffs,
      p.promotion_features, p.display_order, sum(sb.quantity) as total_quantity
    from public.products p
    join active_balances sb on sb.product_id = p.id
    where p.active
    group by p.id
    having sum(sb.quantity) > 0
  ), normal_prices as (
    select pr.product_id, pr.sale_price
    from public.price_rules pr
    join public.customer_types ct on ct.id = pr.customer_type_id
    where pr.active and ct.active and ct.code = 'normal'
  )
  select jsonb_build_object(
    'settings', (
      select jsonb_build_object('header', s.value ->> 'header', 'footer', s.value ->> 'footer')
      from public.app_settings s where s.key = 'whatsapp_promotion'
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'promotion_name', p.promotion_name,
        'approximate_puffs', p.approximate_puffs,
        'promotion_features', p.promotion_features,
        'display_order', p.display_order,
        'total_quantity', p.total_quantity,
        'normal_price', pr.sale_price::text,
        'variants', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sb.variant_id,
            'name', sb.variant_name,
            'is_ice', sb.variant_is_ice,
            'quantity', sb.quantity
          ) order by public.flavor_display_name(sb.variant_name, sb.variant_is_ice), sb.variant_id)
          from active_balances sb
          where sb.product_id = p.id and sb.quantity > 0
        ), '[]'::jsonb)
      ) order by p.display_order nulls last, p.name, p.id)
      from available_products p
      left join normal_prices pr on pr.product_id = p.id
    ), '[]'::jsonb),
    'warnings', coalesce((
      select jsonb_agg(
        'Estoque negativo em ' || p.name || ' · '
        || public.flavor_display_name(sb.variant_name, sb.variant_is_ice)
        || '. Confira as movimentações em Estoque.'
        order by p.name, public.flavor_display_name(sb.variant_name, sb.variant_is_ice), sb.variant_id
      )
      from active_balances sb join public.products p on p.id = sb.product_id
      where sb.quantity < 0
    ), '[]'::jsonb)
  ) into v_snapshot;
  return v_snapshot;
end;
$$;
revoke all on function public.get_whatsapp_promotion_snapshot() from public;
grant execute on function public.get_whatsapp_promotion_snapshot() to authenticated;

notify pgrst, 'reload schema';

commit;
