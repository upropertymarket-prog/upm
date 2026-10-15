-- ---------------------------------------------------------------------------
-- email_events — os recibos (P10-09 · 05 §1.9 · 04 §2.6)
--
-- A segunda metade de P10-09. `scheduled_sends` faz a campanha **sair**; isto é
-- o que volta: entregue, devolvida, aberta, clicada, queixada. Sem esta tabela
-- as métricas de `campaigns` eram cinco zeros com um nome bonito.
--
-- ## A tabela é o registo; os contadores de `campaigns` são a vista rápida
--
-- `20261015090000` pôs `opens`, `clicks`, `bounces` e `unsubscribes` em
-- `campaigns`, com a nota de que "são contadores e não uma vista:
-- `email_events` é a fonte, e manter o total aqui é o que faz a lista de
-- campanhas abrir sem varrer milhões de eventos". Esta migração é o outro lado
-- dessa frase — e a regra que a torna verdadeira: **os contadores só sobem com
-- o primeiro evento de cada tipo por destinatário.**
--
-- Isso é uma decisão de produto, não uma optimização. Um cliente de e-mail que
-- carrega as imagens três vezes gera três aberturas, e um relatório que diz
-- "300 aberturas" sobre 100 pessoas não é um relatório — é um número que
-- ninguém pode usar. O registo guarda os três eventos; o contador conta uma
-- pessoa. Quem quiser o total em bruto vai a `email_events`, e é para isso que
-- ela existe.
--
-- ## Dois tipos nascem sem produtor, e os dois estão no doc
--
-- `read_receipt` é um aviso de leitura MDN — coisa de IMAP, da caixa do
-- Suporte, e não do Resend. `unsubscribed` já tem produtor: é o nosso próprio
-- `campaign_unsubscribe()`, que passa a registar o evento aqui (ver mais
-- abaixo) para que o registo seja o registo **todo** e não só a parte que vem
-- de fora.
-- ---------------------------------------------------------------------------

create type public.email_event_type as enum (
  'delivered',
  'bounced',
  'opened',
  'read_receipt',
  'clicked',
  'unsubscribed',
  'complained'
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),

  -- O id da mensagem no provedor (o `email_id` do Resend). É a chave que liga
  -- um evento ao destinatário — ver `campaign_recipients.provider_message_id`.
  message_ref text not null check (length(message_ref) between 1 and 200),
  recipient text not null check (position('@' in recipient) > 1),
  type public.email_event_type not null,

  -- Só nos cliques: para onde. É o que distingue um relatório de cliques de um
  -- número de cliques (P10-10).
  url text,

  -- A ligação, quando o evento é de uma campanha. Nula num evento de um e-mail
  -- transacional, que `notification_deliveries` serve e que também passa pelo
  -- Resend.
  campaign_id uuid references public.campaigns (id) on delete cascade,
  recipient_id uuid references public.campaign_recipients (id) on delete cascade,

  -- O corpo do evento como veio, para quando a conta não bater. Sem dados
  -- pessoais além do endereço, que já está na coluna acima.
  payload jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.email_events is
  'P10-09 · 05 §1.9: os recibos do Resend e os nossos. A fonte das métricas; os contadores de campaigns são a vista rápida sobre ela.';

/**
 * **Um evento de cada tipo por mensagem e por destinatário**, e é o que torna a
 * função de registo idempotente: o Resend reentrega um webhook que não respondeu
 * 200, e sem isto a mesma abertura contava duas vezes.
 *
 * O `recipient` faz parte da chave e não é redundante: um envio transacional em
 * cópia para dois endereços **partilha o `message_ref`**, e sem ele a entrega ao
 * segundo destinatário era descartada como se fosse uma reentrega da do
 * primeiro. Nas campanhas cada pessoa tem o seu próprio envio e o seu próprio
 * id, mas a tabela serve as duas coisas.
 *
 * O `coalesce(url, '')` é o que deixa dois cliques em **links diferentes** da
 * mesma mensagem entrarem os dois — que é informação, ao contrário de dois
 * cliques no mesmo link.
 */
create unique index email_events_once_uidx
  on public.email_events (message_ref, recipient, type, coalesce(url, ''));

create index email_events_campaign_idx on public.email_events (campaign_id, type);
create index email_events_occurred_idx on public.email_events (occurred_at desc);

-- ---------------------------------------------------------------------------
-- A coluna que liga os dois lados
--
-- Sem ela um webhook do Resend não tem como encontrar o destinatário: o que ele
-- manda é o id dele e o endereço. O worker grava-o no momento em que o envio é
-- aceite.
-- ---------------------------------------------------------------------------

alter table public.campaign_recipients
  add column if not exists provider_message_id text;

create index if not exists campaign_recipients_provider_idx
  on public.campaign_recipients (provider_message_id)
  where provider_message_id is not null;

comment on column public.campaign_recipients.provider_message_id is
  'P10-09: o `email_id` do Resend. É por aqui que um recibo encontra o destinatário.';

-- ---------------------------------------------------------------------------
-- RLS — leitura do Marketing, escrita por função
-- ---------------------------------------------------------------------------

alter table public.email_events enable row level security;

create policy email_events_marketing_select on public.email_events
  for select using (public.is_marketing());

-- ---------------------------------------------------------------------------
-- campaign_recipient_provider_id — o worker guarda o id do envio
-- ---------------------------------------------------------------------------

create or replace function public.campaign_recipient_provider_id(
  p_id uuid,
  p_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.campaign_recipients
     set provider_message_id = nullif(btrim(coalesce(p_provider_message_id, '')), '')
   where id = p_id;
end;
$$;

revoke all on function public.campaign_recipient_provider_id(uuid, text)
  from public, anon, authenticated;
grant execute on function public.campaign_recipient_provider_id(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- record_email_event — a única porta dos recibos
--
-- Faz três coisas em sequência, e a ordem importa: **registar**, **derivar** e
-- **contar**. Se o registo não entrar (porque já existia), as outras duas não
-- correm — é assim que uma reentrega do webhook não conta a mesma abertura duas
-- vezes.
--
-- O que cada tipo deriva no destinatário:
--
-- - `delivered` → `status = 'delivered'`. Não mexe em `sent`: entregue é mais
--   do que enviado, e voltar atrás seria perder informação.
-- - `opened` → `opened_at`, e só a primeira vez.
-- - `clicked` → `clicked_at`, e **também** `opened_at` se estiver vazio: quem
--   clica abriu, e há clientes que bloqueiam o pixel da abertura e deixam
--   passar o clique. Sem isto, um relatório mostrava mais cliques do que
--   aberturas, que é um estado impossível a dizer ao cliente.
-- - `bounced` → `status = 'bounced'` **e uma supressão**: um endereço que
--   devolve não volta a ser tentado, nesta campanha nem em nenhuma. É o que
--   protege a reputação de envio.
-- - `complained` → supressão também, e com razão própria. Uma queixa é mais
--   grave do que um cancelamento: o provedor dela já nos marcou.
-- - `unsubscribed` → a supressão é de `campaign_unsubscribe()`, que é quem a
--   sabe fazer com o token. Aqui só se registam.
-- ---------------------------------------------------------------------------

create or replace function public.record_email_event(
  p_message_ref text,
  p_recipient text,
  p_type public.email_event_type,
  p_url text default null,
  p_occurred_at timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_campaign uuid;
  v_event uuid;
  v_email text := lower(btrim(coalesce(p_recipient, '')));
begin
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'O recibo tem de trazer um endereço.' using errcode = '22023';
  end if;

  -- Pelo id do provedor **e** pelo endereço, pela mesma razão que o põe no
  -- índice único: um envio em cópia partilha o id, e contar o evento no
  -- primeiro destinatário que aparecesse era contá-lo na pessoa errada.
  select r.id, r.campaign_id into v_recipient, v_campaign
    from public.campaign_recipients r
   where r.provider_message_id = p_message_ref
     and r.email = v_email
   limit 1;

  insert into public.email_events (
    message_ref, recipient, type, url, campaign_id, recipient_id, payload, occurred_at
  ) values (
    p_message_ref, v_email, p_type, nullif(btrim(coalesce(p_url, '')), ''),
    v_campaign, v_recipient, coalesce(p_payload, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  on conflict (message_ref, recipient, type, coalesce(url, '')) do nothing
  returning id into v_event;

  -- Já existia: é uma reentrega do webhook. Registar é tudo o que havia a
  -- fazer, e não se faz outra vez.
  if v_event is null then
    return false;
  end if;

  -- Um evento de um e-mail transacional não tem destinatário de campanha para
  -- derivar; fica registado e é tudo.
  if v_recipient is null then
    return true;
  end if;

  if p_type = 'delivered' then
    update public.campaign_recipients
       set status = 'delivered'
     where id = v_recipient and status in ('sending', 'sent');

  elsif p_type = 'opened' then
    update public.campaign_recipients
       set opened_at = coalesce(opened_at, coalesce(p_occurred_at, now()))
     where id = v_recipient;
    update public.campaigns set opens = opens + 1 where id = v_campaign;

  elsif p_type = 'clicked' then
    update public.campaign_recipients
       set clicked_at = coalesce(clicked_at, coalesce(p_occurred_at, now())),
           -- Quem clica abriu — ver a nota de topo.
           opened_at = coalesce(opened_at, coalesce(p_occurred_at, now()))
     where id = v_recipient;
    update public.campaigns set clicks = clicks + 1 where id = v_campaign;

  elsif p_type = 'bounced' then
    update public.campaign_recipients set status = 'bounced' where id = v_recipient;
    update public.campaigns set bounces = bounces + 1 where id = v_campaign;
    insert into public.email_suppressions (email, reason, campaign_id)
    values (v_email, 'bounce', v_campaign)
    on conflict (email) do update set reason = 'bounce';

  elsif p_type = 'complained' then
    insert into public.email_suppressions (email, reason, campaign_id)
    values (v_email, 'complaint', v_campaign)
    -- Uma queixa sobrepõe-se a uma devolução: é a razão mais grave, e é a que
    -- importa quando alguém perguntar porque é que este endereço está travado.
    on conflict (email) do update set reason = 'complaint';
  end if;

  return true;
end;
$$;

comment on function public.record_email_event(text, text, public.email_event_type, text, timestamptz, jsonb) is
  'P10-09: registra o recibo, deriva o estado do destinatário e conta a métrica — uma vez por tipo e por mensagem. Idempotente: o Resend reentrega.';

revoke all on function public.record_email_event(
  text, text, public.email_event_type, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.record_email_event(
  text, text, public.email_event_type, text, timestamptz, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- `campaign_unsubscribe()` passa a deixar recibo
--
-- O corpo é o de `20261015140000` mais o evento. O registo tem de incluir o que
-- acontece **do nosso lado**: um cancelamento feito no nosso site é um recibo
-- tão real como uma devolução do provedor, e um `email_events` que só tivesse
-- os de fora era um registo com um buraco no meio.
--
-- O `message_ref` de um cancelamento nosso é o `provider_message_id` do envio,
-- quando existe, ou o token — que é o que identifica o destinatário quando o
-- clique vem de um e-mail que ainda não tinha id (um teste, um envio antigo).
-- ---------------------------------------------------------------------------

create or replace function public.campaign_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_email text;
  v_profile uuid;
  v_recipient uuid;
  v_provider text;
  v_novo uuid;
begin
  select campaign_id, email, profile_id, id, provider_message_id
    into v_campaign, v_email, v_profile, v_recipient, v_provider
    from public.campaign_recipients where unsubscribe_token = p_token;

  if not found then return false; end if;

  insert into public.email_suppressions (email, reason, campaign_id)
  values (lower(v_email), 'unsubscribe', v_campaign)
  on conflict (email) do nothing
  returning id into v_novo;

  if v_novo is not null then
    update public.campaigns set unsubscribes = unsubscribes + 1 where id = v_campaign;
  end if;

  if v_profile is not null then
    update public.profiles
       set marketing_consent = false, marketing_consent_at = null
     where id = v_profile;
  else
    update public.site_leads
       set consent_marketing = false, consent_at = null
     where lower(email) = lower(v_email);
  end if;

  -- O recibo. `do nothing` no conflito: dois cliques no mesmo link deixam um
  -- evento, como tudo o mais nesta tabela.
  insert into public.email_events (
    message_ref, recipient, type, campaign_id, recipient_id
  ) values (
    coalesce(v_provider, p_token::text), lower(v_email), 'unsubscribed',
    v_campaign, v_recipient
  )
  on conflict (message_ref, recipient, type, coalesce(url, '')) do nothing;

  return true;
end;
$$;

comment on function public.campaign_unsubscribe(uuid) is
  'P10-08 · 02 §4.3, completa em P10-09: suprime, retira o consentimento, conta uma vez e deixa recibo em email_events.';

revoke all on function public.campaign_unsubscribe(uuid) from public;
grant execute on function public.campaign_unsubscribe(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- campaign_receipts — o que o ecrã da campanha mostra sem varrer a tabela
--
-- Uma contagem por tipo para uma campanha. P10-10 constrói as métricas e os
-- relatórios em CSV por cima de `email_events`; isto é o mínimo que o
-- construtor precisa para deixar de mentir: uma campanha enviada que mostre
-- "0 aberturas" sem dizer se é zero ou se ninguém perguntou é pior do que não
-- mostrar nada.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_receipts(p_campaign_id uuid)
returns table (type public.email_event_type, total bigint, pessoas bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing lê recibos de campanha.' using errcode = '42501';
  end if;

  return query
    select e.type, count(*)::bigint, count(distinct e.recipient)::bigint
      from public.email_events e
     where e.campaign_id = p_campaign_id
     group by e.type
     order by e.type;
end;
$$;

comment on function public.campaign_receipts(uuid) is
  'P10-09: contagem de recibos por tipo, com total e pessoas distintas. A base das métricas de P10-10.';

revoke all on function public.campaign_receipts(uuid) from public, anon;
grant execute on function public.campaign_receipts(uuid) to authenticated;
