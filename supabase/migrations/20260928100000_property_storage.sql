-- UProperty Market — Fase 4 (Imóveis), parte 1/1 do P4-01a
-- Buckets de Storage para fotos/plantas e documentos de imóveis (05 §1.4) +
-- sequência para `properties.ref` (formulário Nova propriedade, P4-02) +
-- função properties_for_map (Mapa, P4-05).

-- ---------------------------------------------------------------------------
-- properties.ref — sequência determinística "UPM-1041", "UPM-1042", ...
-- (05 §1.2 exemplifica UPM-1041…1049 no seed). Começa em 1041 para coincidir
-- com o exemplo do TRD/seed; sem risco de colisão porque não há refs ainda.
-- ---------------------------------------------------------------------------

create sequence public.property_ref_seq start with 1041;

alter table public.properties
  alter column ref set default 'UPM-' || nextval('public.property_ref_seq');

-- ---------------------------------------------------------------------------
-- Buckets — ambos privados (public=false). Leitura pública de fotos de
-- imóveis active/featured passa sempre por signed URL gerada no servidor
-- (Server Action), nunca por URL pública direta: evita reconstruir a policy
-- se moderação/show_exact mudarem as regras (07 §16.1 nota: criação de bucket
-- via migração SQL não é "configuração manual num painel de produção" — essa
-- dívida fica reservada a credenciais/chaves de serviços externos).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media', 'property-media', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png']);

-- Convenção de path: {bucket}/{property_id}/{filename} — o primeiro segmento
-- do nome do objeto é o property_id, para as policies não precisarem de
-- tabela extra a mapear objeto → imóvel.

create policy property_media_objects_owner_staff on storage.objects
  for all using (
    bucket_id = 'property-media'
    and (
      public.is_staff()
      or exists (
        select 1 from public.properties p
        where p.id = (split_part(name, '/', 1))::uuid and p.owner_id = auth.uid()
      )
    )
  ) with check (
    bucket_id = 'property-media'
    and (
      public.is_staff()
      or exists (
        select 1 from public.properties p
        where p.id = (split_part(name, '/', 1))::uuid and p.owner_id = auth.uid()
      )
    )
  );

-- Leitura server-side (signed URL) para imóveis publicados — espelha
-- property_media_public_select (20260927090000_properties.sql).
create policy property_media_objects_public_select on storage.objects
  for select using (
    bucket_id = 'property-media'
    and exists (
      select 1 from public.properties p
      where p.id = (split_part(name, '/', 1))::uuid and p.status in ('active', 'featured')
    )
  );

-- documents: nunca leitura pública (05 §1.4) — só dono+staff.
create policy documents_objects_owner_staff on storage.objects
  for all using (
    bucket_id = 'documents'
    and (
      public.is_staff()
      or exists (
        select 1 from public.properties p
        where p.id = (split_part(name, '/', 1))::uuid and p.owner_id = auth.uid()
      )
    )
  ) with check (
    bucket_id = 'documents'
    and (
      public.is_staff()
      or exists (
        select 1 from public.properties p
        where p.id = (split_part(name, '/', 1))::uuid and p.owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- properties_for_map — 02 §11 (Mapa). security invoker: só lê properties_public
-- (view já pública), sem necessidade de elevar privilégio. Devolve lon/lat já
-- extraídos para o cliente não ter de interpretar `geography` no browser.
-- ---------------------------------------------------------------------------

create or replace function public.properties_for_map(
  p_min_lon double precision default null,
  p_min_lat double precision default null,
  p_max_lon double precision default null,
  p_max_lat double precision default null
)
returns table (
  id uuid,
  lon double precision,
  lat double precision,
  price_cents bigint,
  deal public.property_deal,
  title text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    pp.id,
    extensions.st_x(pp.location_approx::extensions.geometry),
    extensions.st_y(pp.location_approx::extensions.geometry),
    coalesce(pp.price_cents, pp.rent_cents),
    pp.deal,
    pp.title
  from public.properties_public pp
  where pp.location_approx is not null
    and (
      p_min_lon is null
      or extensions.st_within(
        pp.location_approx::extensions.geometry,
        extensions.st_makeenvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)
      )
    );
$$;
