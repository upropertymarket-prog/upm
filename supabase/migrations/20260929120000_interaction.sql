-- UProperty Market — migração da Fase 5 (Interação), parte 1/2
-- Cobre 05 §6.3 (conversas, mensagens, visitas, leads), 07 §1 (morada exata),
-- 07 §5.6 (estados de visita e reagendamento) e 07 §18.2/§18.3 (leads).
--
-- Regra que atravessa este ficheiro: as transições de estado vivem em funções
-- `security definer`, não em UPDATEs soltos da aplicação. São regras de negócio
-- com invariantes (o grant de morada tem de nascer com o `accepted`, o contador
-- de reagendamentos tem de alternar de lado) e 08 §3.2 quer-nas num sítio só,
-- onde a RLS não é a única defesa. As Server Actions chamam estas funções.

-- ---------------------------------------------------------------------------
-- Enums — 05 Anexo A, com as revisões de 07 §5.6 e 07 §18.2
-- ---------------------------------------------------------------------------

-- 07 §5.6 acrescenta `completed` ao enum de 05 Anexo A.
create type public.visit_status as enum (
  'pending', 'accepted', 'rescheduled', 'cancelled', 'completed', 'archived'
);

-- 07 §18.2: quatro estágios (a referência de design tem quatro cartões de
-- pipeline), não os seis de 05 §6.3. A ordem de declaração é a do funil — é
-- o que permite comparar dois estágios e fazer a lead avançar sem nunca recuar.
create type public.lead_stage as enum ('new', 'contacted', 'visit', 'closed');

-- 07 §18.2: o desfecho é uma pergunta diferente do passo do funil. Nulo até
-- `stage = 'closed'`; preenchido à mão pelo proprietário, nunca por trigger.
create type public.lead_outcome as enum ('won', 'lost');

-- ---------------------------------------------------------------------------
-- conversations — 05 §6.3
--
-- Sem `exact_location_shared`: 07 §1.3 remove-a explicitamente, substituída por
-- `property_address_grants` (que tem origem, autor e revogação, e a coluna não
-- tinha). Uma conversa por (imóvel, comprador): o comprador que fale de dois
-- imóveis do mesmo proprietário tem duas conversas, como no protótipo, onde
-- cada linha da lista mostra o imóvel de que se trata.
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, buyer_id),
  constraint conversations_distinct_sides check (buyer_id <> owner_id)
);

-- 08 §4.1/§4.2: índice em toda FK e em toda coluna de junção/ordenação usada.
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_owner_idx on public.conversations (owner_id, last_message_at desc);
create index conversations_property_idx on public.conversations (property_id);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages — 05 §6.3. Realtime (02 §10).
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- 08 §4.3: o contador de não lidas da sidebar e da lista de conversas lê só
-- isto — índice parcial, porque as lidas são a esmagadora maioria das linhas.
create index messages_unread_idx on public.messages (conversation_id, sender_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- visit_requests — 05 §6.3 com o enum e as regras de 07 §5.6
--
-- `last_rescheduled_by` não está em 05 §6.3 e é indispensável: 07 §5.6 manda
-- validar no servidor que "o lado que reagendou por último não pode reagendar
-- outra vez", e o contador sozinho não diz de quem foi a vez.
-- ---------------------------------------------------------------------------

create table public.visit_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  -- data e hora propostas para a visita em si (muda a cada reagendamento)
  proposed_at timestamptz not null,
  message text not null default '',
  status public.visit_status not null default 'pending',
  reschedule_count integer not null default 0 check (reschedule_count between 0 and 3),
  last_rescheduled_by uuid references public.profiles (id),
  cancelled_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_requests_distinct_sides check (buyer_id <> owner_id)
);

create index visit_requests_owner_idx on public.visit_requests (owner_id, proposed_at desc);
create index visit_requests_buyer_idx on public.visit_requests (buyer_id, proposed_at desc);
create index visit_requests_property_idx on public.visit_requests (property_id);

-- 08 §4.3: o job de `completed` (07 §5.6) varre só visitas aceites vencidas.
create index visit_requests_due_idx on public.visit_requests (proposed_at)
  where status in ('accepted', 'rescheduled');

create trigger visit_requests_set_updated_at
  before update on public.visit_requests
  for each row execute function public.set_updated_at();

-- A FK que 07 §1.1 previa em `property_address_grants.visit_request_id` e que
-- ficou por ligar na Fase 2, por a tabela de visitas ainda não existir.
alter table public.property_address_grants
  add constraint property_address_grants_visit_request_fkey
  foreign key (visit_request_id) references public.visit_requests (id) on delete set null;

-- ---------------------------------------------------------------------------
-- owner_leads — 05 §6.3 com as decisões de 07 §18.2 e §18.3
--
-- `owner_id` não está em 05 §6.3 (lá deduzia-se do imóvel). Fica desnormalizado
-- aqui, preenchido pelo trigger: sem ele, cada leitura da página Leads e cada
-- verificação de RLS faria uma subquery a `properties` — e a RLS de `properties`
-- aplica-se dentro da subquery de outra policy (foi exatamente esse o bug de
-- RLS apanhado na Fase 4, ver 08 §9).
-- ---------------------------------------------------------------------------

create table public.owner_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  contact_profile_id uuid not null references public.profiles (id) on delete cascade,
  stage public.lead_stage not null default 'new',
  outcome public.lead_outcome,
  offer_cents bigint,
  source text not null check (source in ('message', 'visit_request')),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, contact_profile_id),
  -- 07 §18.2: o desfecho só existe numa lead fechada.
  constraint owner_leads_outcome_only_when_closed
    check (outcome is null or stage = 'closed')
);

create index owner_leads_owner_idx on public.owner_leads (owner_id, last_activity_at desc);
create index owner_leads_property_idx on public.owner_leads (property_id);
create index owner_leads_contact_idx on public.owner_leads (contact_profile_id);

create trigger owner_leads_set_updated_at
  before update on public.owner_leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads automáticas — 07 §18.3
--
-- Em trigger e não na Server Action: assim uma conversa ou um pedido de visita
-- criados por qualquer via produzem a lead, e não há caminho por onde escapar.
-- A comparação sobre o enum (ordenado pela ordem de declaração, que é a do
-- funil) garante o "só para a frente" — uma lead em `closed` não volta a
-- `contacted` porque o comprador escreveu outra vez.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_owner_lead(
  p_owner_id uuid,
  p_property_id uuid,
  p_contact_id uuid,
  p_stage public.lead_stage,
  p_source text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.owner_leads (owner_id, property_id, contact_profile_id, stage, source)
  values (p_owner_id, p_property_id, p_contact_id, p_stage, p_source)
  on conflict (property_id, contact_profile_id) do update
    set stage = case
          when excluded.stage > owner_leads.stage then excluded.stage
          else owner_leads.stage
        end,
        last_activity_at = now();
$$;

create or replace function public.lead_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;

  -- Só a mensagem do comprador é uma lead: a resposta do proprietário ao seu
  -- próprio anúncio não é um interessado novo.
  if v_conversation.buyer_id = new.sender_id then
    perform public.upsert_owner_lead(
      v_conversation.owner_id, v_conversation.property_id,
      v_conversation.buyer_id, 'contacted', 'message'
    );
  end if;

  update public.conversations
    set last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

create trigger messages_lead_and_activity
  after insert on public.messages
  for each row execute function public.lead_from_message();

create or replace function public.lead_from_visit_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_owner_lead(
    new.owner_id, new.property_id, new.buyer_id,
    case when new.status = 'accepted' then 'visit'::public.lead_stage
         else 'contacted'::public.lead_stage end,
    'visit_request'
  );
  return new;
end;
$$;

create trigger visit_requests_lead_insert
  after insert on public.visit_requests
  for each row execute function public.lead_from_visit_request();

create trigger visit_requests_lead_accepted
  after update of status on public.visit_requests
  for each row when (new.status = 'accepted' and old.status <> 'accepted')
  execute function public.lead_from_visit_request();

-- ---------------------------------------------------------------------------
-- Funções de escrita — 03 F5 e F6, 07 §1.2 e §5.6
--
-- Todas `security definer` com `search_path` fixo (08 §2.4) e todas confirmam
-- o papel de quem chama antes de escrever (08 §7.3 — IDOR). A Server Action
-- valida o input com `zod` por cima, nunca em vez disto.
-- ---------------------------------------------------------------------------

-- 03 F5: "Contactar proprietário (cria conversation)". O comprador não
-- consegue ler `properties` (a RLS só deixa dono e staff), logo não sabe o
-- `owner_id` — por isso a conversa nasce aqui e não num insert direto.
create or replace function public.start_conversation(p_property_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_status public.property_status;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  select owner_id, status into v_owner_id, v_status
  from public.properties where id = p_property_id;

  if v_owner_id is null then
    raise exception 'Imóvel inexistente' using errcode = 'P0002';
  end if;

  -- Só se contacta sobre o que está publicado; e o dono não se contacta a si.
  if v_status not in ('active', 'featured') then
    raise exception 'Imóvel não está publicado' using errcode = '42501';
  end if;
  if v_owner_id = auth.uid() then
    raise exception 'O proprietário não pode contactar-se a si próprio' using errcode = '42501';
  end if;

  insert into public.conversations (property_id, buyer_id, owner_id)
  values (p_property_id, auth.uid(), v_owner_id)
  on conflict (property_id, buyer_id) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- 03 F6 passo 1. O pedido de visita inclui implicitamente o pedido de morada
-- (07 §1.2.2) — não há dois pedidos separados.
create or replace function public.request_visit(
  p_property_id uuid,
  p_proposed_at timestamptz,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_status public.property_status;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if p_proposed_at <= now() then
    raise exception 'A data da visita tem de ser no futuro' using errcode = '22023';
  end if;

  select owner_id, status into v_owner_id, v_status
  from public.properties where id = p_property_id;

  if v_owner_id is null then
    raise exception 'Imóvel inexistente' using errcode = 'P0002';
  end if;
  if v_status not in ('active', 'featured') then
    raise exception 'Imóvel não está publicado' using errcode = '42501';
  end if;
  if v_owner_id = auth.uid() then
    raise exception 'O proprietário não pode pedir visita ao seu imóvel' using errcode = '42501';
  end if;

  -- Um pedido aberto de cada vez por (imóvel, comprador): pedir duas vezes o
  -- mesmo imóvel enquanto o primeiro está pendente só confunde a agenda.
  if exists (
    select 1 from public.visit_requests
    where property_id = p_property_id and buyer_id = auth.uid()
      and status in ('pending', 'accepted', 'rescheduled')
  ) then
    raise exception 'Já existe um pedido de visita em curso para este imóvel' using errcode = '23505';
  end if;

  insert into public.visit_requests (property_id, buyer_id, owner_id, proposed_at, message)
  values (p_property_id, auth.uid(), v_owner_id, p_proposed_at, coalesce(p_message, ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- 07 §1.2.4: aceitar muda o estado **e** cria o grant, numa única transação.
-- Duas escritas separadas podiam falhar a meio e deixar uma visita aceite sem
-- morada partilhada — o "estado morto" que 07 §1.2.5 proíbe.
create or replace function public.accept_visit_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visit_requests;
begin
  select * into v from public.visit_requests where id = p_id;
  if v.id is null then
    raise exception 'Pedido inexistente' using errcode = 'P0002';
  end if;
  -- Só o proprietário aceita (08 §7.3).
  if v.owner_id <> auth.uid() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v.status not in ('pending', 'rescheduled') then
    raise exception 'Só um pedido pendente ou reagendado pode ser aceite' using errcode = '42501';
  end if;

  update public.visit_requests set status = 'accepted' where id = p_id;

  insert into public.property_address_grants
    (property_id, buyer_id, granted_by, source, visit_request_id)
  values (v.property_id, v.buyer_id, v.owner_id, 'visit_request', v.id)
  on conflict (property_id, buyer_id) where revoked_at is null do nothing;
end;
$$;

-- 07 §5.6: máximo 3 no total, contador partilhado, lados alternados — o lado
-- que reagendou por último não pode reagendar outra vez.
create or replace function public.reschedule_visit_request(
  p_id uuid,
  p_proposed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visit_requests;
begin
  select * into v from public.visit_requests where id = p_id;
  if v.id is null then
    raise exception 'Pedido inexistente' using errcode = 'P0002';
  end if;
  if auth.uid() not in (v.owner_id, v.buyer_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v.status not in ('pending', 'accepted', 'rescheduled') then
    raise exception 'Esta visita já não pode ser reagendada' using errcode = '42501';
  end if;
  if v.reschedule_count >= 3 then
    raise exception 'Limite de 3 reagendamentos atingido' using errcode = '42501';
  end if;
  if v.last_rescheduled_by = auth.uid() then
    raise exception 'A vez de reagendar é do outro lado' using errcode = '42501';
  end if;
  if p_proposed_at <= now() then
    raise exception 'A nova data tem de ser no futuro' using errcode = '22023';
  end if;

  update public.visit_requests
    set status = 'rescheduled',
        proposed_at = p_proposed_at,
        reschedule_count = v.reschedule_count + 1,
        last_rescheduled_by = auth.uid()
  where id = p_id;
end;
$$;

-- 03 F6: cancelar é dos dois lados, em qualquer momento antes de a visita
-- acontecer. 07 §1.2.7: cancelar **não** revoga o grant de morada.
create or replace function public.cancel_visit_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visit_requests;
begin
  select * into v from public.visit_requests where id = p_id;
  if v.id is null then
    raise exception 'Pedido inexistente' using errcode = 'P0002';
  end if;
  if auth.uid() not in (v.owner_id, v.buyer_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v.status not in ('pending', 'accepted', 'rescheduled') then
    raise exception 'Esta visita já não pode ser cancelada' using errcode = '42501';
  end if;

  update public.visit_requests
    set status = 'cancelled', cancelled_by = auth.uid()
  where id = p_id;
end;
$$;

-- 07 §5.6: `archived` é ação manual, a partir de `completed` ou `cancelled`.
create or replace function public.archive_visit_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visit_requests;
begin
  select * into v from public.visit_requests where id = p_id;
  if v.id is null then
    raise exception 'Pedido inexistente' using errcode = 'P0002';
  end if;
  if auth.uid() not in (v.owner_id, v.buyer_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v.status not in ('completed', 'cancelled') then
    raise exception 'Só uma visita realizada ou cancelada pode ser arquivada' using errcode = '42501';
  end if;

  update public.visit_requests set status = 'archived' where id = p_id;
end;
$$;

-- 07 §1.2.6: partilha manual da morada exata, a partir do chat, sem visita.
create or replace function public.share_exact_address(p_property_id uuid, p_buyer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.properties where id = p_property_id;
  if v_owner_id is null then
    raise exception 'Imóvel inexistente' using errcode = 'P0002';
  end if;
  if v_owner_id <> auth.uid() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  insert into public.property_address_grants
    (property_id, buyer_id, granted_by, source)
  values (p_property_id, p_buyer_id, v_owner_id, 'manual')
  on conflict (property_id, buyer_id) where revoked_at is null do nothing;
end;
$$;

-- 07 §1.2.7: revogar é do proprietário, no detalhe do imóvel.
create or replace function public.revoke_address_grant(p_grant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select p.owner_id into v_owner_id
  from public.property_address_grants g
  join public.properties p on p.id = g.property_id
  where g.id = p_grant_id;

  if v_owner_id is null then
    raise exception 'Permissão inexistente' using errcode = 'P0002';
  end if;
  if v_owner_id <> auth.uid() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.property_address_grants
    set revoked_at = now()
  where id = p_grant_id and revoked_at is null;
end;
$$;

-- 07 §18.2/§18.3: fechar uma lead é sempre manual, e é a única transição que a
-- aplicação faz diretamente. `outcome` é obrigatório ao fechar e proibido fora.
create or replace function public.set_lead_stage(
  p_lead_id uuid,
  p_stage public.lead_stage,
  p_outcome public.lead_outcome default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.owner_leads where id = p_lead_id;
  if v_owner_id is null then
    raise exception 'Lead inexistente' using errcode = 'P0002';
  end if;
  if v_owner_id <> auth.uid() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_stage = 'closed' and p_outcome is null then
    raise exception 'Indique se o negócio se concretizou' using errcode = '22023';
  end if;
  if p_stage <> 'closed' and p_outcome is not null then
    raise exception 'Só uma lead fechada tem desfecho' using errcode = '22023';
  end if;

  update public.owner_leads
    set stage = p_stage, outcome = p_outcome, last_activity_at = now()
  where id = p_lead_id;
end;
$$;

-- As mensagens que o outro lado enviou passam a lidas quando a conversa é
-- aberta. `read_at` é de 05 §6.3 e é também a fonte do contador da sidebar.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversations
    where id = p_conversation_id and auth.uid() in (buyer_id, owner_id)
  ) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  update public.messages
    set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — 02 §7.1
--
-- `conversations` e `messages` ficam **só para os participantes**, sem exceção
-- para staff: 02 §7.1 diz "staff apenas com motivo registado em audit_log", e
-- esse caminho auditado não existe nesta fase. Dar `is_staff()` agora seria
-- abrir um acesso sem o registo que o doc exige.
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.visit_requests enable row level security;
alter table public.owner_leads enable row level security;

create policy conversations_participants on public.conversations
  for select using (auth.uid() in (buyer_id, owner_id));

-- Escrita só por `start_conversation()`, que resolve o `owner_id` e valida o
-- estado do imóvel. Sem policy de insert, o caminho direto fica fechado.

create policy messages_participants_select on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.owner_id)
    )
  );

create policy messages_participants_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.owner_id)
    )
  );

-- Visitas: os dois lados leem; staff lê para suporte (aqui não há conteúdo de
-- conversa, é uma marcação). Escrita só pelas funções acima.
create policy visit_requests_participants_select on public.visit_requests
  for select using (auth.uid() in (buyer_id, owner_id) or public.is_staff());

-- Leads: só o proprietário. O comprador nunca vê em que gaveta do funil está.
create policy owner_leads_owner_select on public.owner_leads
  for select using (owner_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Realtime — 02 §10 (`messages` e `visit_requests`). A publicação respeita a
-- RLS acima: cada cliente só recebe as linhas que já podia ler.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.visit_requests;
