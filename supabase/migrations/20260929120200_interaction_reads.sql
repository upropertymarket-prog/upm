-- UProperty Market — migração da Fase 5 (Interação), parte 3/3
-- Leituras das listas de interação e correção do lado que aceita uma visita.
--
-- Porque é que estas listas não são um `select` normal da aplicação: a RLS de
-- `profiles` (base.sql) só deixa cada um ler-se a si e ao staff, e a de
-- `properties` só o dono e o staff. Um comprador não consegue, por isso,
-- descobrir o nome do proprietário nem o título do imóvel de que está a falar
-- — e uma lista de conversas sem nome nem imóvel não é uma lista de conversas.
-- A saída não é alargar essas policies (dava acesso a tudo, para todos): é
-- devolver por função apenas as colunas que a conversa já implica, a quem
-- participa nela. É o mesmo raciocínio de `properties_public` na Fase 2.

-- ---------------------------------------------------------------------------
-- Correção: quem pode aceitar (03 F6 passo 3′)
--
-- A versão da parte 1 só deixava o proprietário aceitar. 03 F6 dá o passo 3′ —
-- "Aceitar nova data" — ao **comprador**, quando foi o proprietário a
-- reagendar. A regra que serve os dois sentidos é: aceita quem **não** propôs a
-- data que está em cima da mesa.
--
-- O grant de morada continua a ser sempre concedido pelo proprietário
-- (`granted_by = owner_id`): quando é ele que propõe a data, propor é
-- consentir — 07 §1.2.5 não admite uma visita aceite sem morada partilhada.
-- ---------------------------------------------------------------------------

create or replace function public.accept_visit_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visit_requests;
  v_may_accept boolean;
begin
  select * into v from public.visit_requests where id = p_id;
  if v.id is null then
    raise exception 'Pedido inexistente' using errcode = 'P0002';
  end if;
  if auth.uid() not in (v.owner_id, v.buyer_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v.status not in ('pending', 'rescheduled') then
    raise exception 'Só um pedido pendente ou reagendado pode ser aceite' using errcode = '42501';
  end if;

  -- Sem reagendamentos, a data é a que o comprador pediu: aceita o dono.
  -- Com reagendamentos, a data é de quem reagendou por último: aceita o outro.
  v_may_accept := case
    when v.reschedule_count = 0 then auth.uid() = v.owner_id
    else v.last_rescheduled_by is distinct from auth.uid()
  end;

  if not v_may_accept then
    raise exception 'A data atual foi proposta por si — cabe ao outro lado aceitar'
      using errcode = '42501';
  end if;

  update public.visit_requests set status = 'accepted' where id = p_id;

  insert into public.property_address_grants
    (property_id, buyer_id, granted_by, source, visit_request_id)
  values (v.property_id, v.buyer_id, v.owner_id, 'visit_request', v.id)
  on conflict (property_id, buyer_id) where revoked_at is null do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- my_conversations — a lista da esquerda de 04 §8.3 "Mensagens"
-- ---------------------------------------------------------------------------

create or replace function public.my_conversations()
returns table (
  id uuid,
  property_id uuid,
  property_title text,
  property_location text,
  other_id uuid,
  other_name text,
  last_message text,
  last_message_at timestamptz,
  unread integer,
  is_owner boolean,
  buyer_id uuid,
  address_shared boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.property_id,
    coalesce(nullif(p.title, ''), p.ref),
    nullif(concat_ws(' · ', nullif(p.city, ''), nullif(p.district, '')), ''),
    other.id,
    coalesce(nullif(other.full_name, ''), 'Utilizador'),
    coalesce(
      (select m.body from public.messages m
        where m.conversation_id = c.id order by m.created_at desc limit 1),
      ''
    ),
    c.last_message_at,
    (select count(*) from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.read_at is null)::integer,
    c.owner_id = auth.uid(),
    c.buyer_id,
    exists (
      select 1 from public.property_address_grants g
      where g.property_id = c.property_id
        and g.buyer_id = c.buyer_id
        and g.revoked_at is null
    )
  from public.conversations c
  join public.properties p on p.id = c.property_id
  join public.profiles other
    on other.id = case when c.buyer_id = auth.uid() then c.owner_id else c.buyer_id end
  where auth.uid() in (c.buyer_id, c.owner_id)
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- my_visit_requests — Agenda do proprietário (04 §8.3) e Meus pedidos do
-- comprador (04 §8.4). A mesma lista dos dois lados, com `is_owner` a dizer de
-- que lado o leitor está.
-- ---------------------------------------------------------------------------

create or replace function public.my_visit_requests()
returns table (
  id uuid,
  property_id uuid,
  property_title text,
  property_location text,
  other_id uuid,
  other_name text,
  proposed_at timestamptz,
  message text,
  status public.visit_status,
  reschedule_count integer,
  rescheduled_by_me boolean,
  is_owner boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.property_id,
    coalesce(nullif(p.title, ''), p.ref),
    nullif(concat_ws(' · ', nullif(p.city, ''), nullif(p.district, '')), ''),
    other.id,
    coalesce(nullif(other.full_name, ''), 'Utilizador'),
    v.proposed_at,
    v.message,
    v.status,
    v.reschedule_count,
    v.last_rescheduled_by is not distinct from auth.uid(),
    v.owner_id = auth.uid()
  from public.visit_requests v
  join public.properties p on p.id = v.property_id
  join public.profiles other
    on other.id = case when v.buyer_id = auth.uid() then v.owner_id else v.buyer_id end
  where auth.uid() in (v.buyer_id, v.owner_id)
  order by v.proposed_at desc;
$$;

-- ---------------------------------------------------------------------------
-- my_owner_leads — a tabela de 04 §8.3 "Leads". Só o proprietário: o comprador
-- nunca vê em que gaveta do funil está (é a policy de `owner_leads`, repetida
-- aqui porque a função corre como definer e a RLS não a filtra).
-- ---------------------------------------------------------------------------

create or replace function public.my_owner_leads()
returns table (
  id uuid,
  property_id uuid,
  property_title text,
  property_location text,
  contact_id uuid,
  contact_name text,
  stage public.lead_stage,
  outcome public.lead_outcome,
  last_message text,
  last_activity_at timestamptz,
  conversation_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.property_id,
    coalesce(nullif(p.title, ''), p.ref),
    nullif(concat_ws(' · ', nullif(p.city, ''), nullif(p.district, '')), ''),
    contact.id,
    coalesce(nullif(contact.full_name, ''), 'Utilizador'),
    l.stage,
    l.outcome,
    coalesce(
      (select m.body from public.messages m
        join public.conversations c2 on c2.id = m.conversation_id
        where c2.property_id = l.property_id
          and c2.buyer_id = l.contact_profile_id
          and m.sender_id = l.contact_profile_id
        order by m.created_at desc limit 1),
      ''
    ),
    l.last_activity_at,
    (select c3.id from public.conversations c3
      where c3.property_id = l.property_id and c3.buyer_id = l.contact_profile_id)
  from public.owner_leads l
  join public.properties p on p.id = l.property_id
  join public.profiles contact on contact.id = l.contact_profile_id
  where l.owner_id = auth.uid()
  order by l.last_activity_at desc;
$$;
