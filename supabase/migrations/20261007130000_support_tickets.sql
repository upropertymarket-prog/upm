-- ---------------------------------------------------------------------------
-- Tickets de suporte (Fase 10 · Parte 1 — P10-01 · desbloqueia D48)
-- ===========================================================================
-- O pipeline de bugs de 04 §2.7, do lado da base de dados. O esquema é o de
-- 05 §1.8; o que esta migração acrescenta por cima dele são as regras que não
-- podem viver na aplicação:
--
--   - **O `fingerprint` é que manda.** Um erro não tratado que rebenta a dez
--     pessoas é UM ticket com `occurrences = 10`, não dez tickets. E quando
--     alguém reporta à mão um problema que o `fingerprint` já conhece, o
--     ticket não duplica: passa a `origin = 'both'`. Isto vive numa função
--     `security definer` porque a decisão "é novo ou é o mesmo?" tem de ser
--     atómica — dois relatos simultâneos do mesmo erro não podem criar duas
--     linhas (índice único em `fingerprint` + `on conflict`).
--   - **Nada do que o cliente envia decide gravidade.** `severity` é sugerida
--     pelo servidor (ver `suggest_ticket_severity`) e só o Suporte a altera.
--   - **Quem reporta vê o seu ticket e o `fix_note`, e mais nada.** Os factos
--     técnicos — `breadcrumbs`, `console_errors`, `session_id` — são para o
--     Suporte. 04 §2.7 #5 diz que o reporter vê "o que foi corrigido", não a
--     consola de outra pessoa.
--   - **As "últimas ações" têm retenção de 90 dias** (decisão do cliente,
--     7 out 2026, fecha 07 §9 #5). O que expira são as gravações, **não o
--     ticket**: um bug de março continua a existir em junho, sem os
--     breadcrumbs. Apagar o ticket perdia o histórico de qualidade do produto;
--     guardar os breadcrumbs para sempre era retenção de navegação sem fim.
--
-- O workflow (mudar estado, escrever `fix_note`) é exclusivo do Suporte —
-- 07 §5.10. O Admin lê tudo e não escreve nada: `/admin/tickets` é vista de
-- leitura. É a única razão por que há duas policies de update e não uma.
-- ---------------------------------------------------------------------------

create type public.ticket_status as enum (
  'new', 'triage', 'in_progress', 'awaiting_confirmation', 'closed'
);
create type public.ticket_severity as enum ('critical', 'high', 'medium', 'low');
create type public.ticket_origin as enum ('auto', 'report', 'both');

-- ---------------------------------------------------------------------------
-- Referência legível — o `AGXZ-NKGE` de 05 §1.8
--
-- Oito caracteres em dois grupos, de um alfabeto sem `0`, `O`, `1`, `I` e `L`:
-- a referência vai ser lida ao telefone e escrita à mão num e-mail de suporte,
-- e `O` contra `0` é o erro que se paga mais vezes. 31^8 ≈ 850 mil milhões, o
-- que torna a colisão irrelevante — e, se acontecer, o índice único recusa e
-- a função tenta outra.
-- ---------------------------------------------------------------------------

create or replace function public.generate_ticket_ref()
returns text
language plpgsql
volatile
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_ref text := '';
  i integer;
begin
  for i in 1..8 loop
    if i = 5 then
      v_ref := v_ref || '-';
    end if;
    v_ref := v_ref || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_ref;
end;
$$;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default public.generate_ticket_ref(),
  -- `set null`: eliminar a conta (P9-06) não apaga o bug que ela encontrou.
  -- O ticket perde o dono, não a informação técnica.
  reporter_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 3 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  severity public.ticket_severity not null default 'medium',
  status public.ticket_status not null default 'new',
  origin public.ticket_origin not null default 'report',

  -- Contexto técnico capturado pelo cliente (04 §2.7 #2). Nunca conteúdo de
  -- mensagens nem de documentos — o que se guarda é onde estava e o que
  -- clicou, não o que leu.
  route text,
  build_sha text,
  browser text,
  os text,
  viewport text,
  network text,
  session_id text,
  breadcrumbs jsonb,
  console_errors jsonb,
  screenshot_path text,
  -- Posto a `true` pela purga, para o Suporte saber que o silêncio é retenção
  -- cumprida e não captura falhada. Sem isto, um ticket antigo sem
  -- breadcrumbs parece um ticket mal capturado.
  technical_purged_at timestamptz,

  occurrences integer not null default 1 check (occurrences > 0),
  affected_users integer not null default 1 check (affected_users > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  -- O único campo que quem reportou lê (04 §2.7 #5).
  fix_note text check (char_length(fix_note) <= 2000),
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O dedupe. Único, porque é o que torna o `on conflict` de `report_problem`
-- atómico — sem ele, dois relatos simultâneos criavam dois tickets.
create unique index tickets_fingerprint_key on public.tickets (fingerprint);
-- As tabs do Suporte: por estado, mais recentes primeiro.
create index tickets_status_idx on public.tickets (status, last_seen_at desc);
-- "Os meus reports".
create index tickets_reporter_idx on public.tickets (reporter_id, created_at desc);
-- A purga dos breadcrumbs.
create index tickets_purge_idx on public.tickets (last_seen_at)
  where technical_purged_at is null;

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  status_from public.ticket_status,
  status_to public.ticket_status not null,
  note text check (char_length(note) <= 2000),
  actor_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index ticket_events_ticket_idx on public.ticket_events (ticket_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;

-- Quem reportou vê o seu ticket. As colunas técnicas ficam fora das props que
-- a página lhe passa (é a aplicação que escolhe o `select`), mas a linha é
-- dele: é o seu relato, e 04 §2.7 #6 dá-lhe a timeline.
create policy tickets_reporter_select on public.tickets
  for select using (reporter_id = auth.uid());

-- O staff vê tudo: o Suporte para trabalhar, o Admin para a vista global de
-- 07 §5.10 e para o KPI do Painel.
create policy tickets_staff_select on public.tickets
  for select using (public.is_staff());

-- **Só o Suporte escreve.** O Admin cai nesta policy e falha — é deliberado:
-- `/admin/tickets` é só de leitura, e o workflow pertence ao Suporte.
create policy tickets_support_update on public.tickets
  for update using (
    coalesce((select role = 'support' from public.profiles where id = auth.uid()), false)
  )
  with check (
    coalesce((select role = 'support' from public.profiles where id = auth.uid()), false)
  );

-- Nenhuma policy de insert: os tickets nascem por `report_problem()`, que é
-- `security definer`. Um insert direto deixaria o cliente escolher o
-- `fingerprint`, a gravidade e o `reporter_id`.

create policy ticket_events_reporter_select on public.ticket_events
  for select using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_events.ticket_id and t.reporter_id = auth.uid()
    )
  );

create policy ticket_events_staff_select on public.ticket_events
  for select using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Configuração — os dois números que o cliente decidiu a 7 out 2026
-- ---------------------------------------------------------------------------

insert into public.app_settings (key, value, public, description)
values
  (
    'ticket_critical_affected_users',
    '5'::jsonb,
    false,
    'Quantas pessoas distintas no mesmo fingerprint fazem um ticket subir a '
    || 'crítico (04 §2.7 #4, o "N"). 5 por decisão do cliente de 7 out 2026: '
    || 'com 1 ou 2 tudo seria crítico e a palavra deixava de priorizar; com 20 '
    || 'o limiar nunca seria atingido no volume do pré-lançamento. Vive aqui e '
    || 'não em código para mudar sem deploy quando houver tráfego real.'
  ),
  (
    'ticket_technical_retention_days',
    '90'::jsonb,
    false,
    'Retenção das gravações de "últimas ações" dos tickets, em dias (fecha '
    || '07 §9 #5). 90 por decisão do cliente de 7 out 2026. Expira o '
    || 'breadcrumbs/console_errors/session_id, NUNCA o ticket.'
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- suggest_ticket_severity — a sugestão de 04 §2.7 #4
--
-- Três critérios, por esta ordem. Os dois primeiros são binários e não
-- dependem de volume: se o erro rebenta onde se paga ou onde se tratam dados
-- pessoais, é crítico à primeira pessoa. O terceiro é o limiar de volume.
--
-- A lista de prefixos é escolha do agente, não do cliente — fica dita para
-- quem a encontrar. Deriva das rotas que existem hoje: a contratação e o
-- webhook do Stripe são onde se cobra; a Zona de perigo e o contrato são onde
-- se exportam e eliminam dados pessoais (P9-06) e onde vive o NIF. Rota nova
-- nestas famílias ⇒ acrescentar aqui.
-- ---------------------------------------------------------------------------

create or replace function public.suggest_ticket_severity(
  p_route text,
  p_affected_users integer default 1
)
returns public.ticket_severity
language plpgsql
stable
-- `security definer` porque o limiar vive numa linha de `app_settings` com
-- `public = false`, que a policy de `20261002130300` só abre ao staff. Sem
-- isto, a sugestão para um comprador caía sempre no valor por omissão do
-- código e o número em `app_settings` era decorativo. Devolve um enum, não o
-- valor — nada de `app_settings` sai por aqui.
security definer
set search_path = public
as $$
declare
  v_route text := coalesce(p_route, '');
  v_threshold integer;
begin
  if v_route like '/plano%'
     or v_route like '/api/stripe%'
     or v_route like '/criar-conta%'
  then
    return 'critical';
  end if;

  if v_route like '/definicoes%' or v_route like '/partilha%' then
    return 'critical';
  end if;

  select nullif(value::text, 'null')::integer
  into v_threshold
  from public.app_settings
  where key = 'ticket_critical_affected_users';

  if coalesce(p_affected_users, 1) >= coalesce(v_threshold, 5) then
    return 'critical';
  end if;

  -- Sem sinal nenhum, `medium`. Não `low`: um relato que chegou ao ponto de
  -- alguém escrever uma descrição não é, por omissão, pouco importante.
  return 'medium';
end;
$$;

grant execute on function public.suggest_ticket_severity(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- report_problem — a única porta de entrada de um ticket
--
-- Uma chamada, três desfechos possíveis, todos atómicos:
--
--   1. `fingerprint` novo  → ticket novo, com a gravidade sugerida.
--   2. `fingerprint` conhecido, mesma origem → `occurrences + 1`.
--   3. `fingerprint` conhecido, origem diferente → `origin = 'both'` (04 §2.7
--      #3: "relatos manuais com o mesmo fingerprint fundem-se").
--
-- E em qualquer um deles: um ticket `closed` que volta a acontecer **reabre**
-- em `new`. Um erro que regressa não é um ticket resolvido com mais uma
-- ocorrência — é um ticket aberto, e tem de voltar à fila do Suporte.
-- ---------------------------------------------------------------------------

create or replace function public.report_problem(
  p_fingerprint text,
  p_title text,
  p_description text default '',
  p_origin public.ticket_origin default 'report',
  p_route text default null,
  p_build_sha text default null,
  p_browser text default null,
  p_os text default null,
  p_viewport text default null,
  p_network text default null,
  p_session_id text default null,
  p_breadcrumbs jsonb default null,
  p_console_errors jsonb default null,
  p_screenshot_path text default null
)
returns table (id uuid, ref text, severity public.ticket_severity, merged boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
  v_id uuid;
  v_ref text;
  v_severity public.ticket_severity;
  v_merged boolean := false;
  v_previous_status public.ticket_status;
begin
  if v_reporter is null then
    raise exception 'not_authenticated' using hint = 'not_authenticated';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'title_required' using hint = 'title_required';
  end if;

  select t.id, t.ref, t.status into v_id, v_ref, v_previous_status
  from public.tickets t
  where t.fingerprint = p_fingerprint;

  if v_id is not null then
    v_merged := true;

    update public.tickets t
    set
      occurrences = t.occurrences + 1,
      last_seen_at = now(),
      updated_at = now(),
      -- Pessoa diferente no mesmo erro ⇒ conta como afetada. A mesma pessoa a
      -- reportar duas vezes não inflaciona o número que decide a gravidade.
      affected_users = case
        when t.reporter_id is distinct from v_reporter then t.affected_users + 1
        else t.affected_users
      end,
      origin = case
        when t.origin = p_origin then t.origin
        else 'both'::public.ticket_origin
      end,
      status = case when t.status = 'closed' then 'new'::public.ticket_status else t.status end,
      -- Um ticket reaberto perde a nota da correção anterior: ela deixou de
      -- ser verdadeira, e mostrá-la a quem acabou de reportar seria dizer-lhe
      -- que o problema está resolvido.
      fix_note = case when t.status = 'closed' then null else t.fix_note end
    where t.id = v_id
    returning t.severity into v_severity;

    -- A reabertura fica no histórico, como qualquer mudança de estado. A
    -- condição é o estado ANTERIOR, lido antes do update: perguntar depois
    -- "está em `new`?" dava um evento falso a cada ocorrência de um ticket
    -- que nunca saiu de `new`.
    if v_previous_status = 'closed' then
      insert into public.ticket_events (ticket_id, status_from, status_to, note)
      values (v_id, 'closed', 'new', 'Reaberto: o problema voltou a ser reportado.');
    end if;
  else
    v_severity := public.suggest_ticket_severity(p_route, 1);

    insert into public.tickets (
      reporter_id, title, description, severity, origin, fingerprint,
      route, build_sha, browser, os, viewport, network, session_id,
      breadcrumbs, console_errors, screenshot_path
    )
    values (
      v_reporter, trim(p_title), coalesce(p_description, ''), v_severity,
      p_origin, p_fingerprint,
      p_route, p_build_sha, p_browser, p_os, p_viewport, p_network, p_session_id,
      p_breadcrumbs, p_console_errors, p_screenshot_path
    )
    returning tickets.id, tickets.ref into v_id, v_ref;

    insert into public.ticket_events (ticket_id, status_to, note, actor_id)
    values (v_id, 'new', 'Recebido.', v_reporter);
  end if;

  return query select v_id, v_ref, v_severity, v_merged;
end;
$$;

revoke execute on function public.report_problem(
  text, text, text, public.ticket_origin, text, text, text, text, text, text,
  text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.report_problem(
  text, text, text, public.ticket_origin, text, text, text, text, text, text,
  text, jsonb, jsonb, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- set_ticket_status — o workflow, só para o Suporte
--
-- A verificação de papel está aqui dentro **e** na RLS. Não é redundância
-- inútil: é a mesma razão de 07 §20.5 — esta função é `security definer`, logo
-- passa por cima da policy, e sem a verificação interna o Admin escreveria.
-- ---------------------------------------------------------------------------

create or replace function public.set_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status,
  p_fix_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from public.ticket_status;
begin
  if not coalesce(
    (select role = 'support' from public.profiles where id = v_actor), false
  ) then
    raise exception 'not_support' using hint = 'not_support';
  end if;

  select status into v_from from public.tickets where id = p_ticket_id;
  if v_from is null then
    raise exception 'ticket_not_found' using hint = 'ticket_not_found';
  end if;

  -- Fechar sem dizer o que foi corrigido é fechar sem resposta: 04 §2.7 #5
  -- promete a quem reportou o texto "o que foi corrigido".
  if p_status = 'closed' and coalesce(trim(p_fix_note), '') = '' then
    raise exception 'fix_note_required' using hint = 'fix_note_required';
  end if;

  update public.tickets
  set status = p_status,
      fix_note = coalesce(nullif(trim(p_fix_note), ''), fix_note),
      updated_at = now()
  where id = p_ticket_id;

  insert into public.ticket_events (ticket_id, status_from, status_to, note, actor_id)
  values (p_ticket_id, v_from, p_status, nullif(trim(p_fix_note), ''), v_actor);
end;
$$;

revoke execute on function public.set_ticket_status(uuid, public.ticket_status, text)
  from public, anon;
grant execute on function public.set_ticket_status(uuid, public.ticket_status, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- open_bugs_count — fecha D48
--
-- O KPI "bugs abertos" do Painel do Admin (04 §2.5), omitido desde a Fase 8
-- por decisão do cliente (07 §21.2): um zero era indistinguível de "nenhum
-- bug aberto" enquanto a tabela não existisse. Existe agora.
-- ---------------------------------------------------------------------------

create or replace function public.open_bugs_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_staff() then (
      select count(*)::integer from public.tickets where status <> 'closed'
    )
    else 0
  end;
$$;

grant execute on function public.open_bugs_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Retenção de 90 dias — as gravações, não os tickets
-- ---------------------------------------------------------------------------

create or replace function public.purge_ticket_technical_data()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_count integer;
begin
  select nullif(value::text, 'null')::integer
  into v_days
  from public.app_settings
  where key = 'ticket_technical_retention_days';

  update public.tickets
  set breadcrumbs = null,
      console_errors = null,
      session_id = null,
      technical_purged_at = now()
  where technical_purged_at is null
    and last_seen_at < now() - make_interval(days => greatest(coalesce(v_days, 90), 1));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_ticket_technical_data() from public, anon;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-purge-ticket-technical-data', '30 4 * * *',
      'select public.purge_ticket_technical_data()'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Capturas de ecrã — bucket privado, 5 MB, só imagem
--
-- Convenção de path: `{profile_id}/{ticket_fingerprint}.png`. O primeiro
-- segmento é o dono, que é o que a policy lê — a mesma figura de
-- `property-media` em `20260928100000`.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-screenshots', 'ticket-screenshots', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Carregar: só para a sua própria pasta. Ler: o staff, para ver a captura no
-- detalhe do ticket.
create policy ticket_screenshots_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ticket-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ticket_screenshots_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-screenshots'
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );
