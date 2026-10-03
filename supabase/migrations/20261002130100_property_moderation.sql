-- UProperty Market — Fase 8 (Admin), P8-03
-- Fila e decisões de moderação reversíveis, auditadas e notificadas.

create table public.property_moderation_events (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in ('approved', 'rejected', 'featured', 'unfeatured', 'reopened')),
  status_from public.property_status not null,
  status_to public.property_status not null,
  reason text,
  created_at timestamptz not null default now()
);

create index property_moderation_events_property_idx
  on public.property_moderation_events (property_id, created_at desc, id desc);
create index property_moderation_events_actor_idx
  on public.property_moderation_events (actor_id);

alter table public.property_moderation_events enable row level security;
create policy property_moderation_events_staff_select
  on public.property_moderation_events for select using (public.is_staff());
create policy property_moderation_events_owner_select
  on public.property_moderation_events for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_moderation_events.property_id
        and p.owner_id = auth.uid()
    )
  );

revoke all on public.property_moderation_events from anon, authenticated;
grant select on public.property_moderation_events to authenticated;
revoke all on sequence public.property_moderation_events_id_seq from anon, authenticated;

comment on table public.property_moderation_events is
  'Histórico append-only de decisões de moderação. Staff lê tudo; o proprietário lê o histórico do seu imóvel.';

-- notifications.type é uma lista fechada. Acrescentar a categoria de moderação
-- mantém a validação da tabela e permite respeitar preferências em notify().
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'message', 'visit_request', 'visit_update', 'price_drop', 'search_alert',
    'document_shared', 'ticket_update', 'invoice', 'property_moderation'
  )
);

-- Listagem curta para cartões. Toda a coleção vem limitada por cursor; os dados
-- privados de endereço ficam no RPC de detalhe e nunca entram nesta resposta.
create or replace function public.admin_list_moderation(
  p_status public.property_status,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_direction text default 'next',
  p_limit integer default 25
)
returns table (
  id uuid,
  ref text,
  title text,
  deal public.property_deal,
  status public.property_status,
  city text,
  price_cents bigint,
  rent_cents bigint,
  owner_name text,
  cover_path text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_status not in ('pending_review', 'active', 'rejected', 'featured') then
    raise exception 'Estado de moderação inválido' using errcode = '22023';
  end if;
  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception 'Cursor inválido' using errcode = '22023';
  end if;
  if p_direction not in ('next', 'prev') then
    raise exception 'Direção inválida' using errcode = '22023';
  end if;

  if p_direction = 'prev' and p_cursor_id is not null then
    return query
    with profile_page as (
      select p.id, p.ref, p.title, p.deal, p.status, p.city, p.price_cents,
        p.rent_cents, pr.full_name as owner_name, media.path as cover_path, p.created_at
      from public.properties p
      join public.profiles pr on pr.id = p.owner_id
      left join lateral (
        select m.path
        from public.property_media m
        where m.property_id = p.id and m.kind = 'photo'
        order by m.is_cover desc, m.position asc, m.id asc
        limit 1
      ) media on true
      where p.status = p_status
        and (p.created_at, p.id) > (p_cursor_created_at, p_cursor_id)
      order by p.created_at asc, p.id asc
      limit v_limit
    )
    select profile_page.id, profile_page.ref, profile_page.title, profile_page.deal,
      profile_page.status, profile_page.city, profile_page.price_cents, profile_page.rent_cents,
      profile_page.owner_name, profile_page.cover_path, profile_page.created_at
    from profile_page
    order by profile_page.created_at desc, profile_page.id desc;
  else
    return query
    select
      p.id,
      p.ref,
      p.title,
      p.deal,
      p.status,
      p.city,
      p.price_cents,
      p.rent_cents,
      pr.full_name,
      media.path,
      p.created_at
    from public.properties p
    join public.profiles pr on pr.id = p.owner_id
    left join lateral (
      select m.path
      from public.property_media m
      where m.property_id = p.id and m.kind = 'photo'
      order by m.is_cover desc, m.position asc, m.id asc
      limit 1
    ) media on true
    where p.status = p_status
      and (p_direction <> 'next' or p_cursor_id is null or (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id))
    order by p.created_at desc, p.id desc
    limit v_limit;
  end if;
end;
$$;

create or replace function public.admin_moderation_counts()
returns table (
  status public.property_status,
  total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select p.status, count(*)::bigint
  from public.properties p
  where p.status in ('pending_review', 'active', 'rejected', 'featured')
  group by p.status;
end;
$$;

create or replace function public.admin_moderation_detail(p_property_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  owner_name text,
  title text,
  description text,
  ref text,
  deal public.property_deal,
  status public.property_status,
  property_type text,
  typology text,
  condition text,
  gross_area numeric,
  net_area numeric,
  bedrooms integer,
  bathrooms integer,
  floor text,
  year_built integer,
  energy_cert text,
  price_cents bigint,
  rent_cents bigint,
  condo_fee_cents bigint,
  imi_cents bigint,
  amenities text[],
  address_line text,
  postal_code text,
  city text,
  parish text,
  district text,
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.owner_id,
    pr.full_name,
    p.title,
    p.description,
    p.ref,
    p.deal,
    p.status,
    p.property_type,
    p.typology,
    p.condition,
    p.gross_area,
    p.net_area,
    p.bedrooms,
    p.bathrooms,
    p.floor,
    p.year_built,
    p.energy_cert,
    p.price_cents,
    p.rent_cents,
    p.condo_fee_cents,
    p.imi_cents,
    p.amenities,
    p.address_line,
    p.postal_code,
    p.city,
    p.parish,
    p.district,
    p.rejection_reason,
    p.published_at,
    p.created_at
  from public.properties p
  join public.profiles pr on pr.id = p.owner_id
  where p.id = p_property_id;
end;
$$;

create or replace function public.admin_property_moderation_history(p_property_id uuid)
returns table (
  id bigint,
  action text,
  status_from public.property_status,
  status_to public.property_status,
  reason text,
  actor_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if not exists (select 1 from public.properties p where p.id = p_property_id) then
    return;
  end if;

  return query
  select
    e.id,
    e.action,
    e.status_from,
    e.status_to,
    e.reason,
    coalesce(nullif(actor.full_name, ''), 'Admin'),
    e.created_at
  from public.property_moderation_events e
  join public.profiles actor on actor.id = e.actor_id
  where e.property_id = p_property_id
  order by e.created_at desc, e.id desc
  limit 20;
end;
$$;

create or replace function public.moderate_property(
  p_property_id uuid,
  p_action text,
  p_reason text default null
)
returns public.property_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property public.properties%rowtype;
  v_status_to public.property_status;
  v_event_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_owner_locale text;
  v_title text;
  v_body text;
begin
  perform public.require_step_up();
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_property_id is null or p_action is null or p_action not in ('approve', 'reject', 'feature', 'unfeature', 'reopen') then
    raise exception 'Ação de moderação inválida' using errcode = '22023';
  end if;
  if length(coalesce(v_reason, '')) > 500 then
    raise exception 'O motivo não pode exceder 500 caracteres' using errcode = '22023';
  end if;

  select p.* into v_property
  from public.properties p
  where p.id = p_property_id
  for update;
  if not found then
    raise exception 'Imóvel não encontrado' using errcode = 'P0002';
  end if;

  case p_action
    when 'approve' then
      if v_property.status <> 'pending_review' then
        raise exception 'Só se aprovam imóveis pendentes' using errcode = '22023';
      end if;
      v_status_to := 'active';
      v_event_action := 'approved';
    when 'reject' then
      if v_property.status <> 'pending_review' or length(coalesce(v_reason, '')) < 3 then
        raise exception 'Rejeição exige um motivo e um imóvel pendente' using errcode = '22023';
      end if;
      v_status_to := 'rejected';
      v_event_action := 'rejected';
    when 'feature' then
      if v_property.status <> 'active' then
        raise exception 'Só se destaca um imóvel ativo' using errcode = '22023';
      end if;
      v_status_to := 'featured';
      v_event_action := 'featured';
    when 'unfeature' then
      if v_property.status <> 'featured' then
        raise exception 'Só se remove o destaque de um imóvel destacado' using errcode = '22023';
      end if;
      v_status_to := 'active';
      v_event_action := 'unfeatured';
    when 'reopen' then
      if v_property.status not in ('active', 'featured', 'rejected') then
        raise exception 'Só se reabre um imóvel aprovado ou rejeitado' using errcode = '22023';
      end if;
      v_status_to := 'pending_review';
      v_event_action := 'reopened';
  end case;

  update public.properties p
  set status = v_status_to,
      rejection_reason = case when p_action = 'reject' then v_reason else null end,
      published_at = case when p_action = 'approve' then coalesce(p.published_at, now()) else p.published_at end
  where p.id = p_property_id;

  insert into public.property_moderation_events (
    property_id, actor_id, action, status_from, status_to, reason
  )
  values (p_property_id, auth.uid(), v_event_action, v_property.status, v_status_to, v_reason);

  perform public.write_audit_log(
    'property.' || v_event_action,
    'properties',
    p_property_id,
    jsonb_build_object(
      'before', jsonb_build_object('status', v_property.status),
      'after', jsonb_build_object('status', v_status_to),
      'reason', v_reason
    )
  );

  select pr.locale into v_owner_locale from public.profiles pr where pr.id = v_property.owner_id;
  if p_action = 'approve' then
    v_title := case when v_owner_locale = 'en' then 'Property approved' else 'Imóvel aprovado' end;
    v_body := case when v_owner_locale = 'en'
      then 'Your property is now visible on the market.'
      else 'O seu imóvel está agora visível no Market.' end;
  elsif p_action = 'reject' then
    v_title := case when v_owner_locale = 'en' then 'Property needs changes' else 'O imóvel precisa de alterações' end;
    v_body := case when v_owner_locale = 'en'
      then 'Reason: ' || v_reason
      else 'Motivo: ' || v_reason end;
  else
    v_title := case when v_owner_locale = 'en' then 'Property status updated' else 'Estado do imóvel atualizado' end;
    v_body := case when v_owner_locale = 'en'
      then 'Your property status changed to ' || v_status_to::text || '.'
      else 'O estado do seu imóvel mudou para ' || v_status_to::text || '.' end;
  end if;

  perform public.notify(
    v_property.owner_id,
    'property_moderation',
    v_title,
    v_body,
    '/propriedades?id=' || p_property_id::text
  );

  return v_status_to;
end;
$$;

revoke all on function public.admin_list_moderation(public.property_status, timestamptz, uuid, text, integer) from public, anon;
revoke all on function public.admin_moderation_counts() from public, anon;
revoke all on function public.admin_moderation_detail(uuid) from public, anon;
revoke all on function public.admin_property_moderation_history(uuid) from public, anon;
revoke all on function public.moderate_property(uuid, text, text) from public, anon;
grant execute on function public.admin_list_moderation(public.property_status, timestamptz, uuid, text, integer) to authenticated;
grant execute on function public.admin_moderation_counts() to authenticated;
grant execute on function public.admin_moderation_detail(uuid) to authenticated;
grant execute on function public.admin_property_moderation_history(uuid) to authenticated;
grant execute on function public.moderate_property(uuid, text, text) to authenticated;

comment on function public.moderate_property(uuid, text, text) is
  'Admin-only state transition. PIN, properties, event, audit log, and owner notification share one transaction.';

-- Staff no longer writes properties through PostgREST. Owners may create drafts
-- and edit their rows; status changes are limited below to submission/archive.
drop policy properties_owner_insert on public.properties;
create policy properties_owner_insert on public.properties
  for insert with check (owner_id = auth.uid() and status = 'draft');

drop policy properties_owner_update on public.properties;
create policy properties_owner_update on public.properties
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- A row-level owner policy still grants the owner access to the status column.
-- Keep submission and archive actions, but block direct self-approval.
create or replace function public.guard_owner_property_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.owner_id and new.status is distinct from old.status then
    if new.status not in ('pending_review', 'archived') then
      raise exception 'Os proprietários só podem submeter ou arquivar o próprio imóvel'
        using errcode = '42501';
    end if;
    if new.status = 'pending_review' and old.status not in ('draft', 'active', 'rejected') then
      raise exception 'Este estado não pode ser submetido à moderação'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger properties_guard_owner_status
  before update of status on public.properties
  for each row execute function public.guard_owner_property_status();
