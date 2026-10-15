-- ---------------------------------------------------------------------------
-- Campanhas de e-mail (P10-08 · 04 §2.6 · 05 §1.9 · 07 §24.6)
--
-- As quatro tabelas que 07 §24.6 dá ao Marketing, com as colunas do doc 05.
-- `scheduled_sends` e `email_events` ficam para **P10-09** (agendamento e
-- recibos), que é a tarefa que as consome — estão especificadas no mesmo sítio
-- e entram com quem as usa.
--
-- ## Dois desvios declarados ao doc 05, e a razão de cada um
--
-- 1. **`blocks`, `subject` e `preheader` ficam só em `campaign_emails`.** O doc
--    lista-os nas duas tabelas, e o próprio doc diz que "uma campanha é uma
--    sequência de 1..N e-mails". Guardar o mesmo conteúdo em dois sítios
--    garante que um fica desatualizado — e, pior, não há forma de saber qual
--    manda quando divergirem. A sequência vive sempre em `campaign_emails`,
--    mesmo com um e-mail só, e `campaigns` fica com o que é da **campanha**:
--    nome, audiência, remetente, fundo, estado, agendamento e métricas.
--    É o mesmo tipo de desvio que 07 §13.1 declarou para `files` ↔
--    `file_versions`, e pela mesma razão. Patch proposto ao doc 05.
--
-- 2. **`profiles` ganha consentimento de marketing.** O doc desenha supressões
--    e não consentimento, o que é um modelo *opt-out*. Os Termos que este
--    projeto redigiu dizem "mediante consentimento, comunicações de marketing"
--    — e é essa frase que vale se alguém a invocar. Decisão do cliente a 15 out
--    2026: **opt-in explícito**. Ver a nota da coluna, mais abaixo.
--
-- ## O Marketing nunca recebe a lista de e-mails
--
-- 07 §24.6 #5, e é a regra que molda este ficheiro: uma audiência resolve-se
-- **no servidor**, numa função `security definer` que devolve à UI **a
-- contagem e mais nada**. Os destinatários só se materializam em
-- `campaign_recipients` no momento do envio, já filtrados por supressões e
-- consentimento. Sem isto, dar acesso a Campanhas era dar uma leitura em bruto
-- de `profiles` e `site_leads` — o oposto do que as páginas legais prometem.
-- ---------------------------------------------------------------------------

create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent');

create type public.campaign_audience as enum (
  'all',
  'owners',
  'buyers',
  'site_leads_pre',
  'site_leads_post'
);

create type public.suppression_reason as enum ('unsubscribe', 'bounce', 'complaint');

-- O estado de **entrega** de cada destinatário. As aberturas e os cliques são
-- datas e não estados: uma pessoa pode abrir sem clicar, e clicar depois de
-- abrir — um enum único obrigaria a escolher qual dos dois contar.
create type public.campaign_recipient_status as enum (
  'pending',
  'sent',
  'delivered',
  'bounced',
  'failed'
);

-- ---------------------------------------------------------------------------
-- O consentimento de marketing — decisão do cliente, 15 out 2026
--
-- **Opt-in explícito**, e não o opt-out que o esquema do doc sugeria. Duas
-- colunas e não um booleano só: a data é a prova de *quando* foi dado, que é o
-- que um pedido de prestação de contas pede — a mesma figura de
-- `site_leads.consent_marketing` + `consent_at`, que existe desde a Fase 8 e
-- cujo `check` garante que as duas andam juntas.
--
-- **Por omissão `false`, e isso é o ponto.** Nenhuma conta existente passa a
-- consentir por efeito desta migração: as audiências de registados devolvem
-- zero até o registo passar a recolher o consentimento. É honesto e é visível,
-- ao contrário de um `true` por omissão, que seria opt-out com outro nome.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_marketing_consent_timestamp;
alter table public.profiles
  add constraint profiles_marketing_consent_timestamp
  check (marketing_consent = (marketing_consent_at is not null));

comment on column public.profiles.marketing_consent is
  'Opt-in explícito para campanhas (decisão do cliente, 15 out 2026). Os Termos prometem "mediante consentimento"; false por omissão, e o registo recolhe-o.';

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  audience public.campaign_audience not null default 'all',

  -- **A caixa é a identidade do remetente, não o transporte** (07 §24.6 #2). O
  -- envio sai pelo Resend, no subdomínio `news.`; o que esta coluna diz é em
  -- nome de quem. Um remetente não verificado no Resend faz a campanha falhar
  -- no envio, não na fila.
  from_mailbox_id uuid references public.mailboxes (id) on delete set null,

  -- O fundo do e-mail (o painel "Estilo" de 04 §2.6). Hexadecimal e não token:
  -- é a terceira exceção viva a 04 §5.1, e pela mesma razão das outras duas —
  -- um cliente de e-mail não tem as `custom properties` do design system.
  email_bg text not null default '#f6f7f9'
    check (email_bg ~* '^#[0-9a-f]{6}$'),

  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,

  -- As métricas de 05 §1.9. São contadores e não uma vista: `email_events`
  -- (P10-09) é a fonte, e manter o total aqui é o que faz a lista de campanhas
  -- abrir sem varrer milhões de eventos. Quem os escreve é o worker.
  recipients integer not null default 0 check (recipients >= 0),
  opens integer not null default 0 check (opens >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  bounces integer not null default 0 check (bounces >= 0),
  unsubscribes integer not null default 0 check (unsubscribes >= 0),

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaigns_scheduled_has_date check (
    status <> 'scheduled' or scheduled_at is not null
  )
);

comment on table public.campaigns is
  'P10-08 · 05 §1.9: a campanha. O conteúdo vive em campaign_emails — ver o desvio declarado no topo de 20261015090000.';

create index campaigns_status_idx on public.campaigns (status, created_at desc);
create index campaigns_due_idx on public.campaigns (scheduled_at)
  where status = 'scheduled';

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- campaign_emails — a sequência (1..N)
--
-- `delay` é um `interval` e não um número de dias: o doc dá o exemplo
-- `+3 days`, e um `interval` aceita-o tal e qual, com horas quando for preciso.
-- `send_at` é o que a passagem de P10-09 calcula a partir dele — guardado, e
-- não recalculado a cada leitura, para que mudar o `delay` de um e-mail não
-- mova silenciosamente os que já foram agendados.
-- ---------------------------------------------------------------------------

create table public.campaign_emails (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,

  position integer not null check (position >= 1),
  name text not null default '' check (length(name) <= 160),
  subject text not null default '' check (length(subject) <= 300),
  preheader text not null default '' check (length(preheader) <= 300),

  -- Os blocos, no contrato de `packages/db/src/campaign-blocks.ts`. `jsonb` e
  -- não uma tabela de blocos: são dez tipos com campos diferentes, lidos e
  -- escritos sempre em conjunto, e nunca consultados por bloco.
  blocks jsonb not null default '[]'::jsonb,

  delay interval not null default '0',
  send_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index campaign_emails_position_uidx
  on public.campaign_emails (campaign_id, position);

create trigger campaign_emails_set_updated_at
  before update on public.campaign_emails
  for each row execute function public.set_updated_at();

comment on table public.campaign_emails is
  'P10-08 · 05 §1.9: os e-mails de uma campanha, por ordem. Uma campanha é uma sequência de 1..N.';

-- ---------------------------------------------------------------------------
-- campaign_recipients — materializados só no envio
-- ---------------------------------------------------------------------------

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  campaign_email_id uuid references public.campaign_emails (id) on delete cascade,

  email text not null check (position('@' in email) > 1),
  -- Nulo para uma lead do site, que não tem conta. É o que distingue as duas
  -- metades de uma audiência mista.
  profile_id uuid references public.profiles (id) on delete set null,

  status public.campaign_recipient_status not null default 'pending',
  opened_at timestamptz,
  clicked_at timestamptz,

  -- O token do link de cancelar subscrição (02 §4.3). Por destinatário e não
  -- por campanha: um link partilhado deixava qualquer pessoa cancelar a
  -- subscrição de outra.
  unsubscribe_token uuid not null default gen_random_uuid(),

  created_at timestamptz not null default now()
);

-- Um destinatário por e-mail da sequência, e não por campanha: numa sequência
-- de três, a mesma pessoa recebe três.
create unique index campaign_recipients_once_uidx
  on public.campaign_recipients (campaign_email_id, email);
create index campaign_recipients_campaign_idx on public.campaign_recipients (campaign_id);
create unique index campaign_recipients_token_uidx
  on public.campaign_recipients (unsubscribe_token);

comment on table public.campaign_recipients is
  'P10-08 · 05 §1.9: quem recebeu o quê. Nasce no envio, nunca antes — a UI só vê contagens (07 §24.6 #5).';

-- ---------------------------------------------------------------------------
-- email_suppressions — quem não recebe, e porquê
--
-- O e-mail é a chave e está em minúsculas por `check`: `Ana@X.pt` e `ana@x.pt`
-- são a mesma caixa, e uma supressão que não as apanhasse às duas não era uma
-- supressão.
-- ---------------------------------------------------------------------------

create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  reason public.suppression_reason not null,
  -- De onde veio, quando veio de uma campanha. Nulo numa queixa do provedor.
  campaign_id uuid references public.campaigns (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index email_suppressions_email_uidx on public.email_suppressions (email);

comment on table public.email_suppressions is
  'P10-08 · 05 §1.9: cancelamentos, devoluções e queixas. Uma linha por endereço; a razão mais recente fica.';

-- ---------------------------------------------------------------------------
-- RLS
--
-- As quatro são do **Marketing** (`is_marketing()`), e não de `is_staff()`:
-- 07 §24.6 é explícito em que o alargamento de `is_staff()` não acontece. O
-- Admin não vê campanhas — não é o trabalho dele, e dar-lhe leitura "porque é
-- admin" era a porta por onde a separação de áreas se desfaz.
--
-- Sem policy de escrita em nenhuma: as linhas nascem e mudam por função
-- `security definer`, como em todo o correio desta fase. `email_suppressions`
-- é o caso mais claro — uma supressão também é escrita pelo worker a partir de
-- uma devolução, e por um clique anónimo em "cancelar subscrição", que não tem
-- sessão nenhuma.
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;
alter table public.campaign_emails enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.email_suppressions enable row level security;

create policy campaigns_marketing_select on public.campaigns
  for select using (public.is_marketing());

create policy campaign_emails_marketing_select on public.campaign_emails
  for select using (public.is_marketing());

create policy campaign_recipients_marketing_select on public.campaign_recipients
  for select using (public.is_marketing());

create policy email_suppressions_marketing_select on public.email_suppressions
  for select using (public.is_marketing());

-- ---------------------------------------------------------------------------
-- campaign_audience_count — a contagem, e **só** a contagem
--
-- É a função que 07 §24.6 #5 descreve. Devolve um número; não devolve, nem
-- pode devolver, a lista. O Marketing escolhe uma audiência e vê quantas
-- pessoas são — e é tudo o que vê.
--
-- As três regras do filtro, por esta ordem:
--  1. **Consentimento** (decisão de 15 out 2026) — `marketing_consent` nos
--     registados, `consent_marketing` nas leads do site.
--  2. **Supressões** — quem cancelou, devolveu ou se queixou não conta.
--  3. **Conta viva** — `status = 'active'`; uma conta eliminada (P9-06) não
--     recebe campanhas.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_audience_count(p_audience public.campaign_audience)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing consulta audiências.' using errcode = '42501';
  end if;

  if p_audience in ('all', 'owners', 'buyers') then
    select count(*) into v_count
      from auth.users u
      join public.profiles p on p.id = u.id
     where p.status = 'active'
       and p.marketing_consent
       and (
         p_audience = 'all' and p.role in ('buyer', 'owner')
         or (p_audience = 'owners' and p.role = 'owner')
         or (p_audience = 'buyers' and p.role = 'buyer')
       )
       and not exists (
         select 1 from public.email_suppressions s where s.email = lower(u.email)
       );
    return coalesce(v_count, 0);
  end if;

  -- As leads do site: o `source` distingue a pré-inscrição da pós-lançamento,
  -- e é o que as audiências `site_leads_pre`/`site_leads_post` de P10-08
  -- apontavam desde que foram escritas (07 §24.3).
  select count(*) into v_count
    from public.site_leads l
   where l.consent_marketing
     and l.source = case p_audience
       when 'site_leads_pre' then 'pre_launch'
       else 'post_launch'
     end
     and not exists (
       select 1 from public.email_suppressions s where s.email = lower(l.email)
     );

  return coalesce(v_count, 0);
end;
$$;

comment on function public.campaign_audience_count(public.campaign_audience) is
  'P10-08 · 07 §24.6 #5: devolve a CONTAGEM de uma audiência e nada mais. A lista só se materializa em campaign_recipients, no envio.';

revoke all on function public.campaign_audience_count(public.campaign_audience) from public, anon;
grant execute on function public.campaign_audience_count(public.campaign_audience) to authenticated;

-- ---------------------------------------------------------------------------
-- O bucket das imagens das campanhas — **público**, como 05 §1.4 diz
--
-- É a diferença entre este bucket e todos os outros da fase, e tem uma razão
-- que não é descuido: um cliente de e-mail abre a imagem **sem sessão**, meses
-- depois, a partir da caixa de entrada de quem a recebeu. Um URL assinado
-- expira e deixa o e-mail com um retângulo partido; um bucket privado não tem
-- como ser lido de lá.
--
-- O que isso obriga: nada de dados pessoais aqui. São imagens de campanha —
-- banners, fotografias de imóveis já públicos, o logótipo.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-assets', 'campaign-assets', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Escrita só do Marketing, no seu próprio prefixo — a mesma figura de
-- `app-updates` e de `ticket-screenshots`. A leitura não precisa de policy:
-- o bucket é público.
create policy campaign_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campaign-assets'
    and public.is_marketing()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy campaign_assets_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'campaign-assets'
    and public.is_marketing()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
