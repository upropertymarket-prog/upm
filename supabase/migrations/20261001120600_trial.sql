-- UProperty Market — Fase 7 (Faturação), P7-06
--
-- Trial de 7 dias e pedidos de extensão (07 §8.1). A tarefa não tinha ID em
-- 06 §15; ganhou-o a 1 out 2026, com o cliente, sem renumerar nada (07 §8.2).
--
-- Duas decisões de implementação, registadas aqui:
--
-- 1. **O trial é do Stripe.** `subscription_data.trial_period_days` no
--    Checkout, e o estado chega por webhook como `trialing` + `trial_ends_at`
--    (P7-03). Contar os sete dias por nossa conta daria duas verdades sobre a
--    mesma subscrição, e a do Stripe é a que cobra.
-- 2. **"Uma vez por perfil, vitalício"** lê-se das subscrições, não de uma
--    coluna nova: uma subscrição nunca se apaga, por isso basta ter existido
--    uma com `trial_ends_at` para o direito estar gasto. Vale mesmo que a
--    conta mude de plano ou cancele e volte.

create table public.trial_extension_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  -- 07 §8.1: "uma única vez". O índice é que o impõe — uma verificação na
  -- aplicação perde a corrida entre dois pedidos simultâneos.
  unique (profile_id)
);

create index trial_extension_requests_status_idx
  on public.trial_extension_requests (status, created_at desc);
create index trial_extension_requests_subscription_idx
  on public.trial_extension_requests (subscription_id);

alter table public.trial_extension_requests enable row level security;

-- Cada um vê o seu pedido; o staff vê todos (Admin › Planos › Pedidos de
-- trial). A escrita é toda por função: pedir tem regras, decidir tem registo.
create policy trial_requests_select_own on public.trial_extension_requests
  for select using (profile_id = auth.uid() or public.is_staff());

/**
 * Tem direito a trial quem nunca teve nenhum. Vitalício, não por plano.
 */
create or replace function public.trial_eligible(p_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id is not null and not exists (
    select 1 from public.subscriptions
    where profile_id = p_profile_id and trial_ends_at is not null
  );
$$;

/**
 * O estado do trial para o ecrã `/plano`: quanto falta, se já se pediu
 * extensão e em que ficou esse pedido.
 */
create or replace function public.trial_status()
returns table (
  eligible boolean,
  trialing boolean,
  trial_ends_at timestamptz,
  request_status text,
  request_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  return query
  select
    public.trial_eligible(v_me),
    exists (
      select 1 from public.subscriptions
      where profile_id = v_me and status = 'trialing' and trial_ends_at > now()
    ),
    (
      select s.trial_ends_at from public.subscriptions s
      where s.profile_id = v_me and s.trial_ends_at is not null
      order by s.trial_ends_at desc limit 1
    ),
    (select r.status from public.trial_extension_requests r where r.profile_id = v_me),
    (select r.reason from public.trial_extension_requests r where r.profile_id = v_me);
end;
$$;

/**
 * Pedir mais 7 dias, com justificação escrita. Só durante o trial e só uma
 * vez — as duas regras são do cliente (07 §8.1).
 */
create or replace function public.request_trial_extension(p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_subscription uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Escreva a justificação do pedido' using errcode = '22023';
  end if;

  select id into v_subscription
  from public.subscriptions
  where profile_id = v_me and status = 'trialing' and trial_ends_at > now()
  order by trial_ends_at desc
  limit 1;

  if v_subscription is null then
    raise exception 'Só se pede mais tempo durante o período de experiência'
      using errcode = '42501';
  end if;

  insert into public.trial_extension_requests (profile_id, subscription_id, reason)
  values (v_me, v_subscription, btrim(p_reason))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Já pediu uma extensão; é uma única vez' using errcode = '23505';
end;
$$;

/**
 * Decisão do Admin. Aprovado soma 7 dias ao fim do trial; recusado deixa a
 * data original. Em qualquer dos casos há notificação e `audit_log` (08 §6.7).
 *
 * Devolve a nova data de fim quando aprova, para a Server Action poder
 * sincronizar o `trial_end` no Stripe — a base de dados e o Stripe têm de
 * dizer o mesmo, e é o Stripe que cobra.
 */
create or replace function public.decide_trial_extension(p_id uuid, p_approve boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_request record;
  v_new_end timestamptz;
begin
  if v_me is null or not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select * into v_request from public.trial_extension_requests where id = p_id;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Este pedido já foi decidido' using errcode = '42501';
  end if;

  update public.trial_extension_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        decided_by = v_me,
        decided_at = now()
  where id = p_id;

  if p_approve and v_request.subscription_id is not null then
    update public.subscriptions
      set trial_ends_at = greatest(trial_ends_at, now()) + interval '7 days'
    where id = v_request.subscription_id
    returning trial_ends_at into v_new_end;
  end if;

  insert into public.notifications (profile_id, type, title, body, link)
  values (
    v_request.profile_id,
    'invoice',
    case when p_approve then 'Mais 7 dias de experiência' else 'Pedido de extensão recusado' end,
    case
      when p_approve then 'O seu período de experiência foi prolongado por mais 7 dias.'
      else 'O período de experiência termina na data original.'
    end,
    '/plano'
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (
    v_me,
    case when p_approve then 'trial.extension.approved' else 'trial.extension.rejected' end,
    'trial_extension_requests',
    p_id,
    jsonb_build_object('profile_id', v_request.profile_id, 'new_trial_end', v_new_end)
  );

  return v_new_end;
end;
$$;

/**
 * Pedidos pendentes para o separador do Admin, já com o nome de quem pediu —
 * mesmo motivo das outras leituras de staff: devolver só a coluna que o
 * contexto implica em vez de alargar a policy de `profiles`.
 */
create or replace function public.admin_trial_requests()
returns table (
  id uuid,
  profile_id uuid,
  client_name text,
  reason text,
  status text,
  trial_ends_at timestamptz,
  created_at timestamptz,
  decided_at timestamptz
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
    r.id,
    r.profile_id,
    coalesce(nullif(btrim(pr.full_name), ''), 'Conta sem nome'),
    r.reason,
    r.status,
    s.trial_ends_at,
    r.created_at,
    r.decided_at
  from public.trial_extension_requests r
  join public.profiles pr on pr.id = r.profile_id
  left join public.subscriptions s on s.id = r.subscription_id
  order by (r.status = 'pending') desc, r.created_at desc
  limit 100;
end;
$$;
