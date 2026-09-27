-- UProperty Market — migração da Fase 2 (schema de domínio), parte 1/3
-- Cobre 05 §1.2 (imóveis) e 08 §4 (índices e escala, entregável nesta fase).
-- property_type e condition ficam como `text` livre: 05 §1.2 não fecha uma
-- lista de valores (só typology tem enum explícito no Anexo A) — fechar aqui
-- seria inventar. A lista definitiva entra com o formulário da Fase 4.

-- No schema `extensions` (não `public`) — é aí que o Supabase espera as
-- extensões relocáveis, e mantém as funções internas do PostGIS fora do
-- `public db lint` (postgis não suporta `alter extension ... set schema`
-- depois de criado, por isso tem de nascer já no sítio certo).
create extension if not exists "postgis" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums — 05 Anexo A
-- ---------------------------------------------------------------------------

create type public.property_deal as enum ('sale', 'rent');

create type public.property_status as enum (
  'draft', 'pending_review', 'active', 'featured',
  'rented', 'sold', 'rejected', 'archived'
);

-- ---------------------------------------------------------------------------
-- properties — 05 §1.2
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  ref text not null unique,
  title text not null default '',
  description text not null default '',
  deal public.property_deal not null,
  status public.property_status not null default 'draft',
  property_type text not null default '',
  typology text not null check (typology in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5+')),
  condition text not null default '',
  gross_area numeric(10, 2),
  net_area numeric(10, 2),
  bedrooms integer,
  bathrooms integer,
  floor text,
  year_built integer,
  energy_cert text,
  price_cents bigint,
  rent_cents bigint,
  condo_fee_cents bigint,
  imi_cents bigint,
  accepts_offers boolean not null default false,
  amenities text[] not null default '{}',
  address_line text,
  postal_code text,
  city text,
  parish text,
  district text,
  -- coordenada exata: privada, nunca exposta diretamente (ver properties_public)
  location geography(Point, 4326),
  -- coordenada aproximada: offset aleatório fixo por imóvel, calculado no servidor
  location_approx geography(Point, 4326),
  approx_radius_m integer not null default 400,
  show_exact boolean not null default false,
  views_count bigint not null default 0,
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.properties.location is
  'Coordenada exata — privada. Nunca expor via properties_public; usar get_property_location().';

-- 08 §4.1/§4.2: índice em toda FK e em toda coluna de filtro/junção frequente.
create index properties_owner_idx on public.properties (owner_id);
create index properties_status_deal_city_idx on public.properties (status, deal, city);

-- 08 §4.3: índice parcial onde há estado dominante (Market só lista active/featured).
create index properties_public_listing_idx on public.properties (published_at desc)
  where status in ('active', 'featured');

-- Índice espacial para o Mapa (02 §11) — só na aproximada, a exata não é consultada em lote.
create index properties_location_approx_gix on public.properties using gist (location_approx);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- property_media — 05 §1.2
-- ---------------------------------------------------------------------------

create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  path text not null,
  kind text not null check (kind in ('photo', 'floorplan')),
  position integer not null default 0,
  is_cover boolean not null default false,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index property_media_property_idx on public.property_media (property_id, position);

create trigger property_media_set_updated_at
  before update on public.property_media
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- property_documents — 05 §1.2
--
-- DECISÃO (07 §17): fica autónoma nesta fase (sem file_id → files), porque
-- `files`/`folders` só nascem na Fase 7 (Cloud), depois da Fase 4 que consome
-- este schema. Quando a Fase 7 criar `files`, junta-se file_id nullable e
-- reconcilia-se — não antes.
-- ---------------------------------------------------------------------------

create table public.property_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime text not null,
  size bigint not null,
  kind text not null check (kind in ('certidao', 'caderneta', 'energetico', 'planta', 'outro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index property_documents_property_idx on public.property_documents (property_id);

create trigger property_documents_set_updated_at
  before update on public.property_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- property_views — 05 §1.2. Agregação diária, append-only, fora do caminho
-- síncrono (08 §4.8) — a escrita real (incremento) fica para a Fase 4.
-- ---------------------------------------------------------------------------

create table public.property_views (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  day date not null,
  views_count bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, day)
);

create index property_views_property_day_idx on public.property_views (property_id, day desc);

-- ---------------------------------------------------------------------------
-- saved_properties — 05 §1.2
-- ---------------------------------------------------------------------------

create table public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  price_at_save_cents bigint,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

create index saved_properties_user_idx on public.saved_properties (user_id);
create index saved_properties_property_idx on public.saved_properties (property_id);

-- ---------------------------------------------------------------------------
-- search_alerts — 05 §1.2
-- ---------------------------------------------------------------------------

create table public.search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index search_alerts_user_idx on public.search_alerts (user_id);

create trigger search_alerts_set_updated_at
  before update on public.search_alerts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — ativada aqui; policies de properties (que dependem de
-- property_address_grants e get_property_location) ficam na próxima
-- migração para não fragmentar a lógica de privacidade em dois sítios.
-- ---------------------------------------------------------------------------

alter table public.properties enable row level security;
alter table public.property_media enable row level security;
alter table public.property_documents enable row level security;
alter table public.property_views enable row level security;
alter table public.saved_properties enable row level security;
alter table public.search_alerts enable row level security;

-- property_media / property_documents: seguem a posse do imóvel.
create policy property_media_owner_staff on public.property_media
  for all using (
    public.is_staff()
    or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  ) with check (
    public.is_staff()
    or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  );

create policy property_media_public_select on public.property_media
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.status in ('active', 'featured')
    )
  );

create policy property_documents_owner_staff on public.property_documents
  for all using (
    public.is_staff()
    or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  ) with check (
    public.is_staff()
    or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  );

-- property_views: dono e staff leem; escrita só pelo servidor (service_role, sem policy de insert).
create policy property_views_owner_staff_select on public.property_views
  for select using (
    public.is_staff()
    or exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid())
  );

-- saved_properties / search_alerts: só o próprio utilizador; staff lê para suporte.
create policy saved_properties_own on public.saved_properties
  for all using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());

create policy search_alerts_own on public.search_alerts
  for all using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid());
