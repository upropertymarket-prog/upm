-- ---------------------------------------------------------------------------
-- O Marketing passa a ser área própria, parte 3/3 — Atualizações (P10-07)
--
-- 04 §2.6 (lista, editor, entrega, pré-visualização) e 04 §8.1.3 (o modal na
-- app, com paginação, versão, imagem e pontos). É a primeira tarefa da área
-- `/marketing`, e é por isso que os dois valores de enum do papel entram com
-- ela e não antes: abrir um papel antes de haver ecrã é criar uma conta que
-- entra e não vê nada (07 §24.6).
--
-- ## Três decisões que moram aqui
--
-- 1. **O que decide se o modal abre é a ausência de uma linha, não um
--    booleano.** `app_update_views` é o registo de quem já viu o quê — 04
--    §8.1.3 diz "visto = registo em `app_update_views`". Um `seen boolean` em
--    `app_updates` não existiria: a mesma atualização é vista por milhares de
--    pessoas em momentos diferentes, e é essa a razão da tabela de junção.
-- 2. **O público é resolvido no servidor.** `app_updates_for_me()` devolve só
--    as atualizações publicadas, do público de quem pergunta e ainda não
--    vistas. A app nunca filtra audiência do lado do cliente — e nunca recebe
--    as que não lhe dizem respeito, o que é a mesma regra das audiências de
--    campanha em 07 §24.6 #5.
-- 3. **Publicar é um estado, não um apagar e recriar.** Uma atualização
--    publicada **não volta a rascunho**: já foi vista por gente, e o registo
--    dessas visualizações ficaria a apontar para um texto que mudou. O que se
--    pode fazer é arquivá-la, e isso deixa de a entregar a quem ainda não a viu.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Os três enums da tarefa
-- ---------------------------------------------------------------------------

-- 04 §2.6: "Rascunho / Agendada / Publicada". `archived` é o quarto estado, que
-- a lista não precisa de mostrar como tab mas que o ciclo precisa de ter: é
-- como se deixa de entregar uma novidade antiga sem a apagar.
create type public.app_update_status as enum ('draft', 'scheduled', 'published', 'archived');

-- 04 §8.1.3: "Conteúdo diferente por público (proprietário / comprador)".
create type public.app_update_audience as enum ('all', 'owners', 'buyers');

-- 04 §2.6: "entrega: faixa agora + modal no próximo login / obrigatória (modal
-- imediato) / só no próximo login". São três, e a diferença entre elas é só
-- *quando* interrompem:
--   banner      — faixa agora; o modal só no próximo login
--   next_login  — nada agora; modal no próximo login
--   mandatory   — modal imediato, sem "Mais tarde"
create type public.app_update_delivery as enum ('banner', 'next_login', 'mandatory');

-- ---------------------------------------------------------------------------
-- app_updates
-- ---------------------------------------------------------------------------

create table public.app_updates (
  id uuid primary key default gen_random_uuid(),

  -- A versão que o modal mostra (04 §8.1.3). Texto e não um número: "1.4" e
  -- "Outubro 2026" são as duas coisas que se escrevem aqui na prática.
  version text not null default '' check (length(version) <= 40),
  title text not null check (length(btrim(title)) between 1 and 160),

  -- O corpo do editor rico, **sanitizado na escrita** (02 §4.3), como as
  -- assinaturas. É HTML e não jsonb de nós: o que a app faz com ele é mostrá-lo
  -- num modal, e um documento estruturado só se justifica quando há mais do que
  -- isso para fazer — foi a mesma decisão do corpo do e-mail em P10-05.
  body_html text not null default '',

  -- Os "pontos" de 04 §8.1.3: a lista curta do que mudou. Separados do corpo
  -- porque o modal os desenha como lista e o corpo como prosa.
  points text[] not null default '{}' check (array_length(points, 1) is null or array_length(points, 1) <= 12),

  -- A imagem do modal. Caminho num bucket, como em todo o projeto; o upload é
  -- de quem edita e entra pelo mesmo caminho que as outras imagens da fase.
  image_path text,
  image_alt text not null default '',

  audience public.app_update_audience not null default 'all',
  status public.app_update_status not null default 'draft',
  delivery public.app_update_delivery not null default 'next_login',

  -- `scheduled_for` é o que faz uma agendada ser agendada. A publicação
  -- efetiva é `published_at`, escrita quando a atualização passa a `published`
  -- — por mão humana ou pela passagem de `publish_due_app_updates()`.
  scheduled_for timestamptz,
  published_at timestamptz,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Uma agendada sem data não tem como ser entregue, e uma publicada sem data
  -- de publicação não tem como ser ordenada. Os dois invariantes ficam no
  -- esquema porque nenhum código os pode esquecer aqui.
  constraint app_updates_scheduled_has_date check (
    status <> 'scheduled' or scheduled_for is not null
  ),
  constraint app_updates_published_has_date check (
    status <> 'published' or published_at is not null
  )
);

comment on table public.app_updates is
  'P10-07 · 04 §2.6 e §8.1.3: novidades das apps. Escrita só por função security definer (marketing); leitura das publicadas por app_updates_for_me().';

create index app_updates_live_idx
  on public.app_updates (status, published_at desc) where status = 'published';
create index app_updates_due_idx
  on public.app_updates (scheduled_for) where status = 'scheduled';

create trigger app_updates_set_updated_at
  before update on public.app_updates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- app_update_views — "visto" é uma linha aqui (04 §8.1.3)
--
-- Sem `updated_at` e sem nada que se possa editar: é um registo de um facto
-- que aconteceu num instante. A chave única é o par, e é ela que faz
-- `mark_app_update_seen()` ser idempotente — carregar duas vezes em "Entendi"
-- não escreve duas linhas.
-- ---------------------------------------------------------------------------

create table public.app_update_views (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.app_updates (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);

create unique index app_update_views_once_uidx
  on public.app_update_views (update_id, profile_id);
create index app_update_views_by_update_idx on public.app_update_views (update_id);

comment on table public.app_update_views is
  'P10-07 · 04 §8.1.3: quem já viu que novidade. A ausência de linha é o que faz o modal abrir.';

-- ---------------------------------------------------------------------------
-- RLS
--
-- `app_updates`: lê quem a vai ver — e lê **só as publicadas**, por policy.
-- O marketing lê todas, incluindo rascunhos, porque é quem as escreve. Não há
-- policy de escrita: as linhas nascem e mudam por função `security definer`,
-- como `files` desde `20260930120300` e `mail_messages` desde `20261013110000`.
-- A razão é a mesma e vale repeti-la: uma policy de `update` não distingue
-- colunas, e aqui há transições de estado que não podem acontecer ao contrário.
--
-- `app_update_views`: cada um vê e escreve a **sua** linha. É a única tabela
-- desta fase com `insert` direto pelo cliente, e é deliberado — o que a linha
-- diz ("eu vi isto") só o próprio pode afirmar, e o `with check` prende-a a
-- `auth.uid()`. O marketing lê todas, para a lista poder mostrar o alcance.
-- ---------------------------------------------------------------------------

alter table public.app_updates enable row level security;
alter table public.app_update_views enable row level security;

create policy app_updates_read_published on public.app_updates
  for select using (status = 'published' or public.is_marketing());

create policy app_update_views_own on public.app_update_views
  for select using (profile_id = auth.uid() or public.is_marketing());

create policy app_update_views_insert_own on public.app_update_views
  for insert with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- app_updates_for_me — o que esta pessoa ainda não viu
--
-- Devolve as publicadas do público de quem pergunta, por ver, mais antigas
-- primeiro: o modal tem paginação (04 §8.1.3) e a ordem de leitura de três
-- novidades é a ordem em que saíram.
--
-- `security definer` para poder ler `profiles.role` sem recursão de RLS, como
-- os helpers de papel de 02 §7.1.
-- ---------------------------------------------------------------------------

create or replace function public.app_updates_for_me()
returns table (
  id uuid,
  version text,
  title text,
  body_html text,
  points text[],
  image_path text,
  image_alt text,
  delivery public.app_update_delivery,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_role public.user_role;
begin
  if v_me is null then
    return;
  end if;

  select p.role into v_role from public.profiles p where p.id = v_me;

  -- Só comprador e proprietário veem novidades: a equipa interna sabe o que
  -- mudou porque foi ela que o escreveu, e um modal de novidades a abrir no
  -- painel do Admin seria ruído.
  if v_role not in ('buyer', 'owner') then
    return;
  end if;

  return query
  select u.id, u.version, u.title, u.body_html, u.points, u.image_path, u.image_alt,
         u.delivery, u.published_at
    from public.app_updates u
   where u.status = 'published'
     and (
       u.audience = 'all'
       or (u.audience = 'owners' and v_role = 'owner')
       or (u.audience = 'buyers' and v_role = 'buyer')
     )
     and not exists (
       select 1 from public.app_update_views v
        where v.update_id = u.id and v.profile_id = v_me
     )
   order by u.published_at
   limit 10;
end;
$$;

revoke all on function public.app_updates_for_me() from public, anon;
grant execute on function public.app_updates_for_me() to authenticated;

-- ---------------------------------------------------------------------------
-- mark_app_update_seen — "Entendi", e o que acontece a "Mais tarde"
--
-- Só o "Entendi" (e o fecho de uma obrigatória) escreve aqui. **"Mais tarde"
-- não marca nada** (04 §8.1.3): fecha o modal e deixa a faixa no topo, e é
-- precisamente por não escrever que a novidade volta no próximo login.
--
-- Existe em vez de um `insert` direto, apesar de a policy o permitir, por uma
-- razão prática: o `on conflict do nothing` tem de estar num sítio só. Sem
-- isso, dois cliques rápidos no "Entendi" davam um erro de chave única na cara
-- de quem só queria fechar uma janela.
-- ---------------------------------------------------------------------------

create or replace function public.mark_app_update_seen(p_update_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  -- Só se marca como vista uma atualização publicada: marcar um rascunho
  -- deixaria uma linha a dizer que alguém viu o que ainda não saiu, e essa
  -- pessoa nunca mais o veria quando saísse.
  if not exists (
    select 1 from public.app_updates where id = p_update_id and status = 'published'
  ) then
    raise exception 'Atualização inexistente ou não publicada' using errcode = 'P0002';
  end if;

  insert into public.app_update_views (update_id, profile_id)
  values (p_update_id, v_me)
  on conflict (update_id, profile_id) do nothing;
end;
$$;

revoke all on function public.mark_app_update_seen(uuid) from public, anon;
grant execute on function public.mark_app_update_seen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- app_update_save — criar e editar, com as transições que fazem sentido
-- ---------------------------------------------------------------------------

create or replace function public.app_update_save(
  p_id uuid,
  p_version text,
  p_title text,
  p_body_html text,
  p_points text[],
  p_image_path text,
  p_image_alt text,
  p_audience public.app_update_audience,
  p_delivery public.app_update_delivery,
  p_scheduled_for timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.app_update_status;
begin
  -- Nos dois lados (07 §20.5). **O marketing e não o Suporte:** as
  -- Atualizações saíram do Suporte a 13 out 2026 porque falam com um público, e
  -- não com uma pessoa que pediu ajuda (07 §24.6).
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing edita atualizações.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'A atualização precisa de um título.' using errcode = '22023';
  end if;

  -- O guarda de HTML inseguro, com as classes POSIX que o ARE do Postgres
  -- reconhece — ver `20261014110100`, onde a versão com `\s` e `\M` não
  -- apanhava nada. Não é a defesa: a sanitização é a do servidor Node (02
  -- §4.3). É a prova de que ela correu.
  if p_body_html ~* '<[[:space:]]*/?[[:space:]]*(script|iframe|style|form|object|embed)([^a-z]|$)'
     or p_body_html ~* '[[:space:]]on[a-z]+[[:space:]]*='
     or p_body_html ~* 'javascript[[:space:]]*:' then
    raise exception 'HTML inseguro: o corpo tem de ser sanitizado antes de ser gravado.'
      using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.app_updates (
      version, title, body_html, points, image_path, image_alt,
      audience, delivery, scheduled_for, created_by
    ) values (
      coalesce(p_version, ''), btrim(p_title), coalesce(p_body_html, ''),
      coalesce(p_points, '{}'), p_image_path, coalesce(p_image_alt, ''),
      coalesce(p_audience, 'all'), coalesce(p_delivery, 'next_login'), p_scheduled_for,
      auth.uid()
    )
    returning id into v_id;
    return v_id;
  end if;

  select status into v_status from public.app_updates where id = p_id;
  if not found then
    raise exception 'Esta atualização já não existe.' using errcode = 'P0002';
  end if;

  -- **Uma publicada não se reescreve.** Já foi vista por gente, e as linhas de
  -- `app_update_views` dessas pessoas ficariam a apontar para um texto
  -- diferente do que elas leram. Para corrigir, arquiva-se e escreve-se outra.
  if v_status in ('published', 'archived') then
    raise exception 'Uma atualização publicada não se edita — arquive-a e escreva outra.'
      using errcode = '42501';
  end if;

  update public.app_updates
     set version = coalesce(p_version, ''),
         title = btrim(p_title),
         body_html = coalesce(p_body_html, ''),
         points = coalesce(p_points, '{}'),
         image_path = p_image_path,
         image_alt = coalesce(p_image_alt, ''),
         audience = coalesce(p_audience, 'all'),
         delivery = coalesce(p_delivery, 'next_login'),
         scheduled_for = p_scheduled_for,
         status = case
           -- Mexer na data de agendamento é o que agenda; tirá-la devolve ao
           -- rascunho. Sem isto haveria um botão "agendar" que só mudava um
           -- estado e uma data que não queria dizer nada.
           when p_scheduled_for is not null then 'scheduled'::public.app_update_status
           else 'draft'::public.app_update_status
         end
   where id = p_id
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.app_update_save(
  uuid, text, text, text, text[], text, text,
  public.app_update_audience, public.app_update_delivery, timestamptz
) from public, anon;
grant execute on function public.app_update_save(
  uuid, text, text, text, text[], text, text,
  public.app_update_audience, public.app_update_delivery, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- app_update_publish / app_update_archive / app_update_delete
-- ---------------------------------------------------------------------------

create or replace function public.app_update_publish(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.app_update_status;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing publica atualizações.' using errcode = '42501';
  end if;

  select status into v_status from public.app_updates where id = p_id;
  if not found then
    raise exception 'Esta atualização já não existe.' using errcode = 'P0002';
  end if;
  if v_status = 'published' then
    raise exception 'Esta atualização já está publicada.' using errcode = '23505';
  end if;
  if v_status = 'archived' then
    raise exception 'Uma atualização arquivada não volta a ser publicada.' using errcode = '42501';
  end if;

  update public.app_updates
     set status = 'published', published_at = now(), scheduled_for = null
   where id = p_id;
end;
$$;

create or replace function public.app_update_archive(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing arquiva atualizações.' using errcode = '42501';
  end if;

  -- Arquivar não apaga as visualizações: quem a viu, viu. O que muda é que
  -- deixa de ser entregue a quem ainda não a viu.
  update public.app_updates set status = 'archived' where id = p_id;
end;
$$;

/**
 * Apagar só alcança o que nunca saiu. Uma publicada tem leitores e um registo
 * de quem a leu; o `on delete cascade` de `app_update_views` levaria esse
 * registo com ela, e com ele a prova de que aquelas pessoas já tinham sido
 * informadas. Para essa, o caminho é arquivar.
 */
create or replace function public.app_update_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing apaga atualizações.' using errcode = '42501';
  end if;

  delete from public.app_updates
   where id = p_id and status in ('draft', 'scheduled');

  if not found then
    raise exception 'Só se apaga uma atualização que nunca foi publicada.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.app_update_publish(uuid) from public, anon;
revoke all on function public.app_update_archive(uuid) from public, anon;
revoke all on function public.app_update_delete(uuid) from public, anon;
grant execute on function public.app_update_publish(uuid) to authenticated;
grant execute on function public.app_update_archive(uuid) to authenticated;
grant execute on function public.app_update_delete(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_due_app_updates — o que torna "Agendada" verdade
--
-- Sem isto, uma atualização agendada ficava agendada para sempre e alguém
-- tinha de se lembrar de carregar em publicar à hora certa. `pg_cron` de
-- quinze em quinze minutos: a precisão de uma novidade de produto é a do
-- quarto de hora, e não a do segundo.
--
-- `security definer` sem `is_marketing()`: quem a corre é o agendador, que não
-- tem sessão nenhuma. O `revoke` fecha-a a todas as sessões.
-- ---------------------------------------------------------------------------

create or replace function public.publish_due_app_updates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.app_updates
     set status = 'published', published_at = now(), scheduled_for = null
   where status = 'scheduled'
     and scheduled_for <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.publish_due_app_updates() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-publish-due-app-updates', '*/15 * * * *',
      'select public.publish_due_app_updates()'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A imagem do modal — bucket próprio, com a validação dos outros
--
-- Leitura para `authenticated`: a imagem aparece no modal de novidades de
-- qualquer comprador ou proprietário, logo tem de ser legível por eles. Não é
-- público: um bucket aberto deixava o conteúdo de uma novidade **agendada** à
-- vista de quem adivinhasse o caminho, e uma novidade é muitas vezes o anúncio
-- de uma funcionalidade que ainda não saiu.
--
-- Escrita só para o marketing, e no seu próprio prefixo — a mesma figura de
-- `ticket-screenshots` e de `mail-attachments`.
-- Convenção de path: `{profile_id}/{uuid}.{ext}`.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-updates', 'app-updates', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy app_updates_image_read on storage.objects
  for select to authenticated
  using (bucket_id = 'app-updates');

create policy app_updates_image_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'app-updates'
    and public.is_marketing()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy app_updates_image_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'app-updates'
    and public.is_marketing()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
