-- UProperty Market — Fase 5, correção de 07 §5.6 (alternância de lados)
--
-- O problema: `last_rescheduled_by` nascia nulo, por isso, num pedido ainda com
-- zero reagendamentos, "o lado que reagendou por último" não era ninguém — e o
-- próprio comprador podia reagendar o pedido que acabara de fazer. A sequência
-- de 07 §5.6 é explícita: "o comprador agenda → o proprietário reagenda (1) →
-- o comprador reagenda (2) → o proprietário reagenda (3)". Quem agenda é um
-- lado a propor uma data, mesmo sem contar para o limite de três.
--
-- A correção é dar-lhe o nome certo: a coluna não guarda quem reagendou, guarda
-- **quem propôs a data que está em cima da mesa**. Com isso, as duas regras
-- ficam a mesma frase, sem casos especiais: quem propôs não pode repropor nem
-- aceitar; o outro lado pode as duas coisas.

alter table public.visit_requests rename column last_rescheduled_by to proposed_by;

comment on column public.visit_requests.proposed_by is
  'Quem propôs a data atual: o comprador no pedido inicial, depois quem reagendou por último (07 §5.6).';

-- Pedidos já existentes sem proponente: a data atual é a do pedido inicial.
update public.visit_requests
  set proposed_by = buyer_id
where proposed_by is null;

-- ---------------------------------------------------------------------------
-- request_visit — passa a registar o comprador como proponente da data
-- ---------------------------------------------------------------------------

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

  if exists (
    select 1 from public.visit_requests
    where property_id = p_property_id and buyer_id = auth.uid()
      and status in ('pending', 'accepted', 'rescheduled')
  ) then
    raise exception 'Já existe um pedido de visita em curso para este imóvel' using errcode = '23505';
  end if;

  insert into public.visit_requests
    (property_id, buyer_id, owner_id, proposed_at, message, proposed_by)
  values (p_property_id, auth.uid(), v_owner_id, p_proposed_at, coalesce(p_message, ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_visit_request — aceita quem não propôs a data atual
-- ---------------------------------------------------------------------------

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
  if auth.uid() not in (v.owner_id, v.buyer_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v.status not in ('pending', 'rescheduled') then
    raise exception 'Só um pedido pendente ou reagendado pode ser aceite' using errcode = '42501';
  end if;
  if v.proposed_by = auth.uid() then
    raise exception 'A data atual foi proposta por si — cabe ao outro lado aceitar'
      using errcode = '42501';
  end if;

  update public.visit_requests set status = 'accepted' where id = p_id;

  -- 07 §1.2.4/§1.2.5: aceitar e partilhar a morada são o mesmo ato. O grant é
  -- sempre concedido pelo proprietário, mesmo quando é o comprador a aceitar a
  -- data que o proprietário propôs — propor é consentir na visita.
  insert into public.property_address_grants
    (property_id, buyer_id, granted_by, source, visit_request_id)
  values (v.property_id, v.buyer_id, v.owner_id, 'visit_request', v.id)
  on conflict (property_id, buyer_id) where revoked_at is null do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- reschedule_visit_request — repropõe quem não propôs a data atual
-- ---------------------------------------------------------------------------

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
  if v.proposed_by = auth.uid() then
    raise exception 'A vez de propor uma data é do outro lado' using errcode = '42501';
  end if;
  if p_proposed_at <= now() then
    raise exception 'A nova data tem de ser no futuro' using errcode = '22023';
  end if;

  update public.visit_requests
    set status = 'rescheduled',
        proposed_at = p_proposed_at,
        reschedule_count = v.reschedule_count + 1,
        proposed_by = auth.uid()
  where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- my_visit_requests — a coluna mudou de nome; a semântica exposta à UI passa a
-- ser "fui eu que propus esta data", que é o que decide os botões no ecrã.
-- ---------------------------------------------------------------------------

drop function if exists public.my_visit_requests();

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
  proposed_by_me boolean,
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
    v.proposed_by is not distinct from auth.uid(),
    v.owner_id = auth.uid()
  from public.visit_requests v
  join public.properties p on p.id = v.property_id
  join public.profiles other
    on other.id = case when v.buyer_id = auth.uid() then v.owner_id else v.buyer_id end
  where auth.uid() in (v.buyer_id, v.owner_id)
  order by v.proposed_at desc;
$$;
