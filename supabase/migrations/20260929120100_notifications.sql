-- UProperty Market — migração da Fase 5 (Interação), parte 2/2
-- Cobre 05 §6.9 (`notifications`), 02 §10 (tempo real, e-mail, preferências),
-- 07 §5.7 (alerta de descida de preço), 07 §18.4 (fila de envio) e fecha D21
-- (alertas de pesquisa com CRUD mas sem job que os corresse).

-- ---------------------------------------------------------------------------
-- notifications — 05 §6.9. Realtime (02 §10).
--
-- `type` fica `text` com `check`, como 05 §6.9 o define. A lista é a de 02 §10,
-- inteira: os três últimos tipos só são emitidos nas Fases 6, 8 e 9, mas ficam
-- aqui para essas fases não precisarem de mexer na coluna — o `check` existe
-- para impedir tipos inventados, não para datar migrações.
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'message', 'visit_request', 'visit_update', 'price_drop', 'search_alert',
    'document_shared', 'ticket_update', 'invoice'
  )),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

-- 08 §4.3: o contador do sino lê só as não lidas.
create index notifications_unread_idx on public.notifications (profile_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_own_select on public.notifications
  for select using (profile_id = auth.uid());

-- Marcar como lida é a única escrita do cliente (04 §5.5, dropdown do sino).
create policy notifications_own_update on public.notifications
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- notification_deliveries — 07 §18.4
--
-- A fila do e-mail. Enche-se nesta fase; esvazia-se quando existir relay (a
-- escolha do fornecedor é confirmação de produção — fim do projeto, 07 §16.1).
-- Sem policy nenhuma, de propósito: RLS ativa e nenhuma policy significa que
-- só a `service_role` lhe toca (08 §2.2) — é fila de servidor, não tem leitor
-- no cliente.
--
-- `group_key` serve o "nova mensagem (agrupada)" de 02 §10: enquanto houver um
-- envio por fazer com a mesma chave, não se enfileira outro. Dez mensagens
-- seguidas dão dez linhas no sino e um e-mail.
-- ---------------------------------------------------------------------------

create type public.delivery_status as enum ('queued', 'sent', 'failed', 'cancelled');

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete set null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email')),
  recipient text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  group_key text,
  status public.delivery_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 08 §4.3: o worker só varre o que está por enviar.
create index notification_deliveries_queued_idx on public.notification_deliveries (created_at)
  where status = 'queued';

create unique index notification_deliveries_group_uidx
  on public.notification_deliveries (profile_id, group_key)
  where status = 'queued' and group_key is not null;

create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;

-- ---------------------------------------------------------------------------
-- notify() — o único sítio que cria notificações (02 §10)
--
-- Lê `profiles.notification_prefs` (05 §6.1): `{"<tipo>": {"inapp": bool,
-- "email": bool}}`. Ausente = ligado — as preferências são opt-out, senão uma
-- conta nova não recebia nada e ninguém perceberia porquê.
-- ---------------------------------------------------------------------------

create or replace function public.notify(
  p_profile_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_group_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
  v_email text;
  v_id uuid;
begin
  select notification_prefs into v_prefs from public.profiles where id = p_profile_id;
  if not found then
    return null;
  end if;

  if coalesce((v_prefs -> p_type ->> 'inapp')::boolean, true) then
    insert into public.notifications (profile_id, type, title, body, link)
    values (p_profile_id, p_type, p_title, coalesce(p_body, ''), p_link)
    returning id into v_id;
  end if;

  if coalesce((v_prefs -> p_type ->> 'email')::boolean, true) then
    select email into v_email from auth.users where id = p_profile_id;
    if v_email is not null then
      insert into public.notification_deliveries
        (notification_id, profile_id, channel, recipient, template, payload, group_key)
      values (
        v_id, p_profile_id, 'email', v_email, p_type,
        jsonb_build_object('title', p_title, 'body', coalesce(p_body, ''), 'link', p_link),
        p_group_key
      )
      on conflict do nothing;
    end if;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos de notificação — 02 §10
-- ---------------------------------------------------------------------------

-- Nova mensagem, para o outro lado da conversa. Agrupada no e-mail pela
-- `group_key`; no sino aparece uma por mensagem.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.conversations;
  v_recipient uuid;
  v_sender text;
  v_property text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  v_recipient := case when new.sender_id = c.buyer_id then c.owner_id else c.buyer_id end;

  select full_name into v_sender from public.profiles where id = new.sender_id;
  select title into v_property from public.properties where id = c.property_id;

  perform public.notify(
    v_recipient,
    'message',
    'Nova mensagem de ' || coalesce(nullif(v_sender, ''), 'um utilizador'),
    left(new.body, 140),
    '/mensagens?conversa=' || c.id::text,
    'message:' || c.id::text
  );
  return new;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- Pedido de visita novo → proprietário (03 F6 passo 1).
create or replace function public.notify_visit_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer text;
  v_property text;
begin
  select full_name into v_buyer from public.profiles where id = new.buyer_id;
  select title into v_property from public.properties where id = new.property_id;

  perform public.notify(
    new.owner_id,
    'visit_request',
    'Novo pedido de visita',
    coalesce(nullif(v_buyer, ''), 'Um comprador') || ' pediu visita a ' ||
      coalesce(nullif(v_property, ''), 'um imóvel') || ' para ' ||
      to_char(new.proposed_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY "às" HH24"h"MI'),
    '/agenda?visita=' || new.id::text
  );
  return new;
end;
$$;

create trigger visit_requests_notify_insert
  after insert on public.visit_requests
  for each row execute function public.notify_visit_request();

-- Mudança de estado → o outro lado (04 §8.3: "notificação ao comprador em cada
-- mudança"; 03 F6 dá o mesmo aos dois sentidos).
create or replace function public.notify_visit_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_recipient uuid;
  v_label text;
begin
  -- O job de `completed` corre sem sessão: aí avisam-se os dois lados.
  if v_actor is null then
    v_recipient := null;
  elsif v_actor = new.owner_id then
    v_recipient := new.buyer_id;
  else
    v_recipient := new.owner_id;
  end if;

  v_label := case new.status
    when 'accepted' then 'Visita confirmada'
    when 'rescheduled' then 'Visita reagendada'
    when 'cancelled' then 'Visita cancelada'
    when 'completed' then 'Visita realizada'
    when 'archived' then 'Visita arquivada'
    else 'Visita atualizada'
  end;

  if v_recipient is null then
    perform public.notify(new.buyer_id, 'visit_update', v_label, '',
      '/meus-pedidos?visita=' || new.id::text);
    perform public.notify(new.owner_id, 'visit_update', v_label, '',
      '/agenda?visita=' || new.id::text);
  else
    perform public.notify(
      v_recipient, 'visit_update', v_label,
      to_char(new.proposed_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY "às" HH24"h"MI'),
      case when v_recipient = new.buyer_id
        then '/meus-pedidos?visita=' || new.id::text
        else '/agenda?visita=' || new.id::text end
    );
  end if;
  return new;
end;
$$;

create trigger visit_requests_notify_update
  after update of status on public.visit_requests
  for each row when (old.status is distinct from new.status)
  execute function public.notify_visit_update();

-- ---------------------------------------------------------------------------
-- Descida de preço — 07 §5.7
--
-- Qualquer descida, sem limiar mínimo, e só a quem tem o imóvel guardado.
-- Depois de notificar, `price_at_save_cents` passa ao valor novo, para a mesma
-- descida não voltar a notificar.
-- ---------------------------------------------------------------------------

-- Euros com espaço a separar os milhares, como 04 §8.6 escreve os números
-- ("9 420"). Não usa `to_char` com G/D porque esses dependem do `lc_numeric`
-- da sessão — o texto da notificação fica guardado e não pode variar com quem
-- disparou o trigger.
create or replace function public.format_eur_cents(p_cents bigint)
returns text
language sql
immutable
as $$
  select case
    when p_cents is null then ''
    else reverse(
      regexp_replace(reverse((p_cents / 100)::bigint::text), '(\d{3})(?=\d)', '\1 ', 'g')
    ) || ' €'
  end;
$$;

create or replace function public.notify_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new bigint := coalesce(new.price_cents, new.rent_cents);
  v_old bigint := coalesce(old.price_cents, old.rent_cents);
  r record;
begin
  if v_new is null or v_old is null or v_new >= v_old then
    return new;
  end if;
  if new.status not in ('active', 'featured') then
    return new;
  end if;

  for r in
    select id, user_id, price_at_save_cents
    from public.saved_properties
    where property_id = new.id
      and price_at_save_cents is not null
      and price_at_save_cents > v_new
  loop
    perform public.notify(
      r.user_id,
      'price_drop',
      'Baixou de preço: ' || coalesce(nullif(new.title, ''), new.ref),
      'De ' || public.format_eur_cents(r.price_at_save_cents) ||
        ' para ' || public.format_eur_cents(v_new),
      '/market/' || new.id::text
    );

    update public.saved_properties
      set price_at_save_cents = v_new
    where id = r.id;
  end loop;

  return new;
end;
$$;

create trigger properties_notify_price_drop
  after update of price_cents, rent_cents on public.properties
  for each row execute function public.notify_price_drop();

-- ---------------------------------------------------------------------------
-- Trabalhos agendados — 07 §5.6 (visita `completed`) e D21 (alertas)
-- ---------------------------------------------------------------------------

-- 07 §5.6: `completed` automático 4 h depois de `proposed_at` numa visita
-- aceite. Só a partir de `completed` aparece "Enviar proposta no chat".
create or replace function public.complete_due_visits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.visit_requests
    set status = 'completed'
  where status in ('accepted', 'rescheduled')
    and proposed_at < now() - interval '4 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- D21: os alertas de pesquisa tinham CRUD desde a Fase 4 e nada que os
-- corresse. Corre cada alerta contra os imóveis publicados desde a última
-- passagem e notifica quando há novidades. Os filtros são os de
-- `propertyFiltersSchema` (packages/db/src/properties.ts) — qualquer campo
-- novo lá tem de entrar também aqui.
create or replace function public.run_search_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  v_since timestamptz;
  v_matches integer;
  v_notified integer := 0;
begin
  for a in select id, user_id, filters, last_run_at, created_at from public.search_alerts loop
    v_since := coalesce(a.last_run_at, a.created_at);

    select count(*) into v_matches
    from public.properties_public p
    where p.published_at > v_since
      and (a.filters ->> 'deal' is null or p.deal::text = a.filters ->> 'deal')
      and (a.filters ->> 'property_type' is null or p.property_type = a.filters ->> 'property_type')
      and (a.filters ->> 'typology' is null or p.typology = a.filters ->> 'typology')
      and (a.filters ->> 'city' is null or p.city ilike a.filters ->> 'city')
      and (
        a.filters ->> 'price_min_cents' is null
        or coalesce(p.price_cents, p.rent_cents) >= (a.filters ->> 'price_min_cents')::bigint
      )
      and (
        a.filters ->> 'price_max_cents' is null
        or coalesce(p.price_cents, p.rent_cents) <= (a.filters ->> 'price_max_cents')::bigint
      );

    if v_matches > 0 then
      perform public.notify(
        a.user_id,
        'search_alert',
        case when v_matches = 1 then 'Há 1 imóvel novo para o seu alerta'
             else 'Há ' || v_matches || ' imóveis novos para o seu alerta' end,
        'Novos anúncios que correspondem aos filtros que guardou.',
        '/guardados/alertas'
      );
      v_notified := v_notified + 1;
    end if;

    update public.search_alerts set last_run_at = now() where id = a.id;
  end loop;

  return v_notified;
end;
$$;

-- pg_cron dentro de uma guarda: se a extensão não estiver disponível no
-- ambiente (por exemplo num Postgres local sem `shared_preload_libraries`), a
-- migração continua e as funções ficam na mesma — chamáveis à mão e pelos
-- testes. O agendamento é o único que se perde.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'upm-complete-due-visits', '*/15 * * * *',
      'select public.complete_due_visits()'
    );
    perform cron.schedule(
      'upm-run-search-alerts', '0 9 * * *',
      'select public.run_search_alerts()'
    );
  end if;
end;
$$;
