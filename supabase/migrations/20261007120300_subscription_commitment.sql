-- UProperty Market — Fase 9, 4/6
--
-- P9-03 (estrutura de subscrição com compromisso configurável), P9-04
-- (cancelamento numa só porta) e P9-08 (histórico e auditoria).
--
-- Três regras que este ficheiro cumpre à letra:
--
-- 1. **Nenhum período mínimo é definido nesta fase.** `minimum_commitment_months`
--    nasce a `null` em todos os sítios e o sistema tem de funcionar com `null`,
--    `0` e `> 0`. Não há valor por omissão escondido num `default`.
-- 2. **Toda a decisão de "pode ou não cancelar" vive numa função única**,
--    `can_cancel_subscription()`. Os ramos do compromisso estão escritos mas
--    inertes: com `null` ou `0` a resposta é sempre "pode". Nenhum bloqueio é
--    implementado nesta fase.
-- 3. **O histórico não é um registo paralelo.** `subscription_events` é
--    append-only e escrito por gatilho, e `account_history()` junta-o ao
--    `audit_log` e a `terms_acceptances` que já existem — não duplica nada.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- subscriptions ganha o contrato: compromisso, cessação e versão dos Termos
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column started_at timestamptz,
  -- null = não há compromisso mínimo definido; 0 = definido como "nenhum";
  -- > 0 = número de meses. Os três casos têm de funcionar (P9-03).
  add column minimum_commitment_months integer
    check (minimum_commitment_months is null or minimum_commitment_months >= 0),
  add column commitment_ends_at timestamptz,
  add column cancel_requested_at timestamptz,
  add column canceled_at timestamptz,
  add column cancel_reason text check (cancel_reason is null or length(btrim(cancel_reason)) <= 1000),
  add column terms_document_id uuid references public.legal_documents (id) on delete set null,
  add column terms_version text;

update public.subscriptions set started_at = created_at where started_at is null;

create index subscriptions_commitment_idx on public.subscriptions (commitment_ends_at)
  where commitment_ends_at is not null;
create index subscriptions_terms_idx on public.subscriptions (terms_document_id);

comment on column public.subscriptions.minimum_commitment_months is
  'Compromisso mínimo em meses. null = não definido (estado de 7 out 2026), 0 = nenhum, >0 = meses (P9-03).';
comment on column public.subscriptions.commitment_ends_at is
  'Fim do compromisso mínimo, calculado de started_at + minimum_commitment_months. null quando não há.';
comment on column public.subscriptions.terms_document_id is
  'Versão dos Termos aceite ao contratar esta subscrição (P9-02/P9-03).';

-- ---------------------------------------------------------------------------
-- Onde o compromisso se configura DEPOIS, sem tocar em código
--
-- Dois níveis, por esta ordem de precedência: o do plano, e o global. Ambos
-- nascem a null — é o que torna verdade "nenhum período mínimo é definido
-- nesta fase".
-- ---------------------------------------------------------------------------

alter table public.plans
  add column default_commitment_months integer
    check (default_commitment_months is null or default_commitment_months >= 0);

comment on column public.plans.default_commitment_months is
  'Compromisso mínimo por plano, em meses. null = usa o global de app_settings (P9-03).';

insert into public.app_settings (key, value, public, description)
values (
  'subscription_default_commitment_months',
  'null'::jsonb,
  true,
  'Compromisso mínimo global, em meses. null = nenhum (POR DECIDIR — P9-03)'
)
on conflict (key) do nothing;

/**
 * O compromisso que se aplica a um plano, hoje. Plano primeiro, global depois.
 * Devolve null quando nada está definido — e null significa "sem compromisso",
 * nunca "zero meses por omissão".
 */
create or replace function public.commitment_months_for_plan(p_plan_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan integer;
  v_global jsonb;
begin
  select default_commitment_months into v_plan from public.plans where id = p_plan_id;
  if v_plan is not null then
    return v_plan;
  end if;

  select value into v_global from public.app_settings
   where key = 'subscription_default_commitment_months';

  if v_global is null or jsonb_typeof(v_global) <> 'number' then
    return null;
  end if;
  return (v_global #>> '{}')::integer;
end;
$$;

grant execute on function public.commitment_months_for_plan(uuid) to authenticated;

/**
 * Preenche o compromisso ao nascer a subscrição e recalcula o seu fim quando o
 * número de meses ou o início mudam. Em gatilho, e não no webhook, por a mesma
 * razão de 07 §20.5: o webhook é um caminho, não é o único.
 */
create or replace function public.subscription_fill_commitment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.started_at is null then
    new.started_at := coalesce(new.created_at, now());
  end if;

  if new.minimum_commitment_months is null then
    new.minimum_commitment_months := public.commitment_months_for_plan(new.plan_id);
  end if;

  if new.minimum_commitment_months is null or new.minimum_commitment_months = 0 then
    new.commitment_ends_at := null;
  else
    new.commitment_ends_at :=
      new.started_at + (new.minimum_commitment_months || ' months')::interval;
  end if;

  -- A data de cessação marca-se aqui, e não no gatilho `after` que escreve o
  -- histórico: um `update` feito de dentro de um gatilho `after` volta a
  -- disparar o próprio gatilho, e um ciclo destes descobre-se tarde.
  if tg_op = 'UPDATE' and new.status = 'canceled' and old.status <> 'canceled' then
    new.canceled_at := coalesce(new.canceled_at, now());
  end if;

  return new;
end;
$$;

create trigger subscriptions_fill_commitment
  before insert or update on public.subscriptions
  for each row execute function public.subscription_fill_commitment();

-- ---------------------------------------------------------------------------
-- can_cancel_subscription — A ÚNICA PORTA (P9-04)
--
-- Nenhuma condição de cancelamento vive no frontend, nem numa Server Action,
-- nem repetida em dois sítios. Quem quer saber se pode cancelar pergunta aqui.
--
-- A resposta é um objeto, não um booleano, porque quem chama precisa de três
-- coisas diferentes: se pode, quando produz efeitos, e — quando não pode — até
-- quando. Um booleano obrigaria a recalcular a data noutro sítio, que é
-- exatamente como as regras se espalham.
--
-- `mode` é o que esta função está preparada para suportar depois:
--   immediate        — termina já
--   end_of_period    — termina no fim do período pago  (a regra de hoje)
--   after_commitment — só depois do fim do compromisso
--   blocked          — impedido até uma data
--
-- **Hoje devolve sempre `allowed = true`**, porque não há compromisso definido
-- (P9-04: nenhum bloqueio é implementado nesta fase). Os ramos ficam escritos
-- para que, no dia em que o cliente fixar um período mínimo, mude um valor em
-- `app_settings` — e não este código.
-- ---------------------------------------------------------------------------

create or replace function public.can_cancel_subscription(p_subscription_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_sub record;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;

  if v_sub.id is null then
    raise exception 'Subscrição inexistente' using errcode = '22023';
  end if;

  -- A posse verifica-se nas duas camadas, como manda 08 §7.3: a RLS já limita
  -- a leitura, e aqui repete-se explicitamente porque a função é definer.
  if v_me is null or (v_sub.profile_id <> v_me and not public.is_staff()) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if v_sub.status in ('canceled') then
    return jsonb_build_object(
      'allowed', false,
      'mode', 'already_canceled',
      'reason_code', 'already_canceled',
      'effective_at', v_sub.canceled_at,
      'blocked_until', null,
      'commitment_months', v_sub.minimum_commitment_months,
      'commitment_ends_at', v_sub.commitment_ends_at
    );
  end if;

  if v_sub.cancel_at_period_end then
    return jsonb_build_object(
      'allowed', false,
      'mode', 'already_requested',
      'reason_code', 'already_requested',
      'effective_at', v_sub.current_period_end,
      'blocked_until', null,
      'commitment_months', v_sub.minimum_commitment_months,
      'commitment_ends_at', v_sub.commitment_ends_at
    );
  end if;

  -- Ramo do compromisso. Inerte enquanto `commitment_ends_at` for null, que é
  -- o estado de hoje em todas as subscrições.
  if v_sub.commitment_ends_at is not null and v_sub.commitment_ends_at > now() then
    return jsonb_build_object(
      'allowed', true,
      'mode', 'after_commitment',
      'reason_code', 'within_commitment',
      'effective_at', greatest(v_sub.commitment_ends_at, coalesce(v_sub.current_period_end, v_sub.commitment_ends_at)),
      'blocked_until', v_sub.commitment_ends_at,
      'commitment_months', v_sub.minimum_commitment_months,
      'commitment_ends_at', v_sub.commitment_ends_at
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'mode', 'end_of_period',
    'reason_code', null,
    'effective_at', v_sub.current_period_end,
    'blocked_until', null,
    'commitment_months', v_sub.minimum_commitment_months,
    'commitment_ends_at', v_sub.commitment_ends_at
  );
end;
$$;

grant execute on function public.can_cancel_subscription(uuid) to authenticated;

comment on function public.can_cancel_subscription(uuid) is
  'Única porta da decisão de cancelamento (P9-04). Hoje permite sempre: nenhum '
  'compromisso mínimo está definido. Nenhuma condição de cancelamento vive fora daqui.';

/**
 * Registar o pedido de cancelamento e o seu motivo. Não cancela no Stripe —
 * isso é da camada de aplicação, que o faz DEPOIS desta função aceitar. A
 * ordem é esta de propósito: a decisão é da base de dados, a execução é de
 * quem fala com o Stripe.
 */
create or replace function public.request_subscription_cancellation(
  p_subscription_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_decision jsonb;
begin
  v_decision := public.can_cancel_subscription(p_subscription_id);

  if not (v_decision ->> 'allowed')::boolean then
    raise exception 'Cancelamento indisponível'
      using errcode = 'P0001', hint = coalesce(v_decision ->> 'reason_code', 'not_allowed');
  end if;

  update public.subscriptions
     set cancel_requested_at = now(),
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_subscription_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (
    v_me,
    'subscription.cancel_requested',
    'subscriptions',
    p_subscription_id,
    jsonb_build_object('mode', v_decision ->> 'mode', 'has_reason', p_reason is not null)
  );

  return v_decision;
end;
$$;

grant execute on function public.request_subscription_cancellation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- subscription_events — o histórico consultável de P9-08
--
-- Append-only, escrito por gatilho. Nasce de `subscriptions` e não de quem a
-- escreve, para que o webhook, uma correção manual de admin e um futuro
-- caminho novo entrem todos no mesmo registo.
-- ---------------------------------------------------------------------------

create table public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  person_identity_id uuid references public.person_identities (id) on delete set null,
  event text not null check (event in (
    'created', 'plan_changed', 'status_changed', 'interval_changed',
    'renewed', 'cancel_requested', 'canceled', 'reactivated', 'commitment_changed'
  )),
  status_from text,
  status_to text,
  plan_id_from uuid references public.plans (id),
  plan_id_to uuid references public.plans (id),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index subscription_events_subscription_idx
  on public.subscription_events (subscription_id, occurred_at desc);
create index subscription_events_profile_idx
  on public.subscription_events (profile_id, occurred_at desc);
create index subscription_events_identity_idx
  on public.subscription_events (person_identity_id, occurred_at desc);

alter table public.subscription_events enable row level security;

create policy subscription_events_select_own on public.subscription_events
  for select using (profile_id = auth.uid() or public.is_staff());

revoke insert, update, delete on public.subscription_events from anon, authenticated;
revoke all on sequence public.subscription_events_id_seq from anon, authenticated;

comment on table public.subscription_events is
  'Histórico append-only da subscrição (P9-08). Escrito por gatilho, nunca pela aplicação.';

create or replace function public.record_subscription_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_identity uuid;
begin
  select person_identity_id into v_identity from public.profiles where id = new.profile_id;

  if tg_op = 'INSERT' then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event,
      status_to, plan_id_to, metadata
    )
    values (
      new.id, new.profile_id, v_identity, 'created',
      new.status, new.plan_id,
      jsonb_build_object(
        'interval', new.interval,
        'minimum_commitment_months', new.minimum_commitment_months,
        'terms_version', new.terms_version
      )
    );
    return new;
  end if;

  if new.plan_id is distinct from old.plan_id then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event, plan_id_from, plan_id_to
    )
    values (new.id, new.profile_id, v_identity, 'plan_changed', old.plan_id, new.plan_id);
  end if;

  if new.status is distinct from old.status then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event, status_from, status_to, reason
    )
    values (
      new.id, new.profile_id, v_identity,
      case
        when new.status = 'canceled' then 'canceled'
        when old.status = 'canceled' then 'reactivated'
        else 'status_changed'
      end,
      old.status, new.status, new.cancel_reason
    );
  end if;

  if new.interval is distinct from old.interval then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event, metadata
    )
    values (
      new.id, new.profile_id, v_identity, 'interval_changed',
      jsonb_build_object('from', old.interval, 'to', new.interval)
    );
  end if;

  if new.cancel_at_period_end and not old.cancel_at_period_end then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event, reason, metadata
    )
    values (
      new.id, new.profile_id, v_identity, 'cancel_requested', new.cancel_reason,
      jsonb_build_object('effective_at', new.current_period_end)
    );
  end if;

  -- Renovação: o período avançou sem nada mais mudar.
  if new.current_period_end is distinct from old.current_period_end
     and new.status = old.status
     and new.plan_id = old.plan_id then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event, metadata
    )
    values (
      new.id, new.profile_id, v_identity, 'renewed',
      jsonb_build_object('period_end', new.current_period_end)
    );
  end if;

  if new.minimum_commitment_months is distinct from old.minimum_commitment_months then
    insert into public.subscription_events (
      subscription_id, profile_id, person_identity_id, event, metadata
    )
    values (
      new.id, new.profile_id, v_identity, 'commitment_changed',
      jsonb_build_object(
        'from', old.minimum_commitment_months,
        'to', new.minimum_commitment_months,
        'ends_at', new.commitment_ends_at
      )
    );
  end if;

  return new;
end;
$$;

create trigger subscriptions_record_event
  after insert or update on public.subscriptions
  for each row execute function public.record_subscription_event();

-- ---------------------------------------------------------------------------
-- account_history — a leitura única de P9-08
--
-- Junta o que já existe em vez de criar um registo paralelo: `audit_log`
-- (criação da conta, aceitação de Termos, eliminação), `subscription_events`
-- (plano, estado, cancelamento, reativação) e `invoices` (estado de
-- pagamento). O painel de Admin não é obrigatório nesta fase — os dados é que
-- têm de permitir construí-lo, e é o que esta função garante.
-- ---------------------------------------------------------------------------

create or replace function public.account_history(p_profile_id uuid default auth.uid())
returns table (
  occurred_at timestamptz,
  source text,
  event text,
  detail jsonb
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
  if p_profile_id <> v_me and not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select e.occurred_at, 'subscription'::text, e.event,
         jsonb_strip_nulls(jsonb_build_object(
           'subscription_id', e.subscription_id,
           'status_from', e.status_from,
           'status_to', e.status_to,
           'plan_from', pf.name,
           'plan_to', pt.name,
           'reason', e.reason,
           'metadata', nullif(e.metadata, '{}'::jsonb)
         ))
    from public.subscription_events e
    left join public.plans pf on pf.id = e.plan_id_from
    left join public.plans pt on pt.id = e.plan_id_to
   where e.profile_id = p_profile_id

  union all
  select a.accepted_at, 'terms'::text, 'accepted'::text,
         jsonb_build_object(
           'kind', a.document_kind, 'version', a.version,
           'content_hash', a.content_hash, 'context', a.context
         )
    from public.terms_acceptances a
   where a.profile_id = p_profile_id

  union all
  select i.issued_at, 'invoice'::text, i.status,
         jsonb_build_object('number', i.number, 'total_cents', i.total_cents)
    from public.invoices i
   where i.profile_id = p_profile_id and i.issued_at is not null

  union all
  select l.created_at, 'account'::text, l.action, jsonb_strip_nulls(l.diff)
    from public.audit_log l
   where l.actor_id = p_profile_id
     and l.action in (
       'account.identity_registered', 'account.deleted', 'account.export_requested',
       'terms.accepted', 'subscription.cancel_requested'
     )

  order by 1 desc;
end;
$$;

grant execute on function public.account_history(uuid) to authenticated;

comment on function public.account_history(uuid) is
  'Histórico consultável da conta (P9-08): subscrição, Termos, faturação e eventos de conta. '
  'Junta registos existentes — não cria nenhum paralelo.';
