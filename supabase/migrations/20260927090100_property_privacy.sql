-- UProperty Market — migração da Fase 2 (schema de domínio), parte 2/3
-- Cobre 07 §1 (localização exata), 08 §2.5/§2.7 (properties_public,
-- get_property_location) e as policies de properties (dependem destas peças).

-- ---------------------------------------------------------------------------
-- property_address_grants — 07 §1.1
-- ---------------------------------------------------------------------------

create table public.property_address_grants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid not null references public.profiles (id),
  source text not null check (source in ('visit_request', 'manual')),
  visit_request_id uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- 07 §1.1: índice único parcial — só um grant ativo por (imóvel, comprador).
create unique index property_address_grants_active_uidx
  on public.property_address_grants (property_id, buyer_id)
  where revoked_at is null;

create index property_address_grants_property_idx on public.property_address_grants (property_id);
create index property_address_grants_buyer_idx on public.property_address_grants (buyer_id);

alter table public.property_address_grants enable row level security;

-- Só o dono do imóvel (que concede/revoga) e o comprador (que vê o que lhe foi
-- concedido) e staff. Escrita fica para a Server Action da Fase 6 — aqui só a
-- policy de leitura; insert/update controlados no servidor com verificação de
-- posse (08 §3.2), não só por RLS.
create policy property_address_grants_select on public.property_address_grants
  for select using (
    buyer_id = auth.uid()
    or public.is_staff()
    or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  );

create policy property_address_grants_owner_write on public.property_address_grants
  for insert with check (
    exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  );

create policy property_address_grants_owner_revoke on public.property_address_grants
  for update using (
    exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- get_property_location — 07 §1.2/§1.3. security definer + search_path fixo
-- (08 §2.4), para poder ler properties e property_address_grants sem depender
-- da RLS de quem chama.
-- ---------------------------------------------------------------------------

create or replace function public.get_property_location(p_property_id uuid)
returns extensions.geography
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_owner_id uuid;
  v_show_exact boolean;
  v_location extensions.geography;
  v_location_approx extensions.geography;
  v_has_grant boolean;
begin
  select owner_id, show_exact, location, location_approx
    into v_owner_id, v_show_exact, v_location, v_location_approx
  from public.properties
  where id = p_property_id;

  if v_owner_id is null then
    return null;
  end if;

  if auth.uid() = v_owner_id or public.is_staff() or v_show_exact then
    return v_location;
  end if;

  select exists (
    select 1 from public.property_address_grants g
    where g.property_id = p_property_id
      and g.buyer_id = auth.uid()
      and g.revoked_at is null
  ) into v_has_grant;

  if v_has_grant then
    return v_location;
  end if;

  return v_location_approx;
end;
$$;

-- ---------------------------------------------------------------------------
-- properties_public — 08 §2.5, 08 §2.7 (colunas privadas fora das views
-- públicas: nunca location, address_line, phone do dono).
--
-- EXCEÇÃO DOCUMENTADA a 08 §2.5: as views expostas usam `security_invoker`,
-- mas esta é a exceção nomeada nessa própria secção. `properties` tem RLS que
-- só deixa dono/staff lerem diretamente (ver policies mais abaixo); esta view
-- existe exatamente para dar ao público um subconjunto seguro de colunas —
-- por isso corre com os direitos do dono da view (default, sem
-- security_invoker), não com os de quem chama, senão herdava a mesma
-- restrição e nunca devolvia nada a anon/buyer.
-- ---------------------------------------------------------------------------

create view public.properties_public
as
select
  id, owner_id, ref, title, description, deal, status, property_type, typology,
  condition, gross_area, net_area, bedrooms, bathrooms, floor, year_built,
  energy_cert, price_cents, rent_cents, condo_fee_cents, imi_cents,
  accepts_offers, amenities, city, parish, district,
  location_approx, approx_radius_m, views_count, published_at,
  created_at, updated_at
from public.properties
where status in ('active', 'featured');

comment on view public.properties_public is
  '08 §2.7: exclui location, address_line, postal_code e qualquer dado do dono além do id. Único caminho de leitura pública de properties.';

-- ---------------------------------------------------------------------------
-- properties — policies (07 §1, 08 §2). Leitura direta só dono/staff; o
-- público lê via properties_public. Escrita: dono cria/edita o seu; staff
-- modera (aprova/rejeita/featured).
-- ---------------------------------------------------------------------------

create policy properties_owner_staff_select on public.properties
  for select using (owner_id = auth.uid() or public.is_staff());

create policy properties_owner_insert on public.properties
  for insert with check (owner_id = auth.uid());

create policy properties_owner_update on public.properties
  for update using (owner_id = auth.uid() or public.is_staff())
  with check (owner_id = auth.uid() or public.is_staff());

create policy properties_owner_delete on public.properties
  for delete using (owner_id = auth.uid() or public.is_staff());
