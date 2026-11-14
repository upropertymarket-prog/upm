-- Oferta do 1.º ano — decisão do cliente de 13 nov 2026.
-- =========================================================================
-- O site passa a mostrar o preço normal riscado e, a seguir, o preço que se
-- paga nos primeiros 12 meses. Findo o 1.º ano, a subscrição passa ao normal.
--
-- **O preço de `plans` continua a ser o que se cobra para sempre** — é o que
-- vai para o `Price` do Stripe e o que se paga a partir do 13.º mês. A oferta
-- é um desconto por cima, com três colunas próprias, e no Stripe é um `Coupon`
-- (12 meses repetidos no mensal, uma vez no anual). Fazê-lo ao contrário —
-- o `Price` barato e uma subida agendada — obrigava a uma `SubscriptionSchedule`
-- por cliente, e um preço que muda sozinho é exatamente o que se quer ver
-- escrito à cabeça, não escondido num agendamento.
--
-- As três colunas vão juntas ou não vão: uma oferta sem duração, ou com preço
-- mas sem meses, seria uma promessa por cumprir no ecrã de preços.
--
-- Proprietário, preços normais / 1.º ano (cliente, 13 nov 2026):
--   Essential  19,99 / 10,99 €/mês   ·  199,90 / 109,90 €/ano
--   Smarter    29,99 / 14,99 €/mês   ·  299,90 / 149,90 €/ano
--   Premium    49,99 / 29,99 €/mês   ·  499,90 / 299,90 €/ano
-- O anual mantém a regra de sempre: 10 × o mensal, nos dois preços.

alter table public.plans
  add column intro_price_month_cents bigint,
  add column intro_price_year_cents bigint,
  add column intro_months integer,
  -- Os `Coupon` do Stripe que aplicam a oferta, escritos por `pnpm stripe:sync`.
  add column stripe_coupon_month_id text,
  add column stripe_coupon_year_id text;

alter table public.plans
  add constraint plans_intro_all_or_nothing check (
    (intro_price_month_cents is null) = (intro_price_year_cents is null)
    and (intro_price_month_cents is null) = (intro_months is null)
  ),
  -- Uma "oferta" igual ou acima do preço normal riscaria o preço para mostrar
  -- outro que não é mais baixo. E a 0 € seria trial, que não existe (P9-05).
  add constraint plans_intro_below_price check (
    intro_price_month_cents is null
    or (
      intro_price_month_cents > 0 and intro_price_month_cents < price_month_cents
      and intro_price_year_cents > 0 and intro_price_year_cents < price_year_cents
    )
  ),
  add constraint plans_intro_months_range check (
    intro_months is null or intro_months between 1 and 36
  );

comment on column public.plans.intro_price_month_cents is
  'Preço mensal da oferta de entrada. null = sem oferta. O preço normal continua em price_month_cents.';
comment on column public.plans.intro_months is
  'Durante quantos meses vale a oferta, contados da subscrição. No anual, 12 = a primeira anuidade.';

update public.plans set
  price_month_cents = 1999, price_year_cents = 19990,
  intro_price_month_cents = 1099, intro_price_year_cents = 10990, intro_months = 12
where slug = 'essential-owner';

update public.plans set
  price_month_cents = 2999, price_year_cents = 29990,
  intro_price_month_cents = 1499, intro_price_year_cents = 14990, intro_months = 12
where slug = 'smarter-owner';

update public.plans set
  price_month_cents = 4999, price_year_cents = 49990,
  intro_price_month_cents = 2999, intro_price_year_cents = 29990, intro_months = 12
where slug = 'premium-owner';

-- ---------------------------------------------------------------------------
-- A subscrição guarda a oferta com que foi contratada
--
-- Escrito pelo webhook a partir dos metadados do Checkout, como os Termos
-- (P9-03): o Admin pode tirar a oferta de `plans` amanhã, e quem a apanhou
-- continua a tê-la — e o contrato tem de o dizer.
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column intro_price_cents bigint check (intro_price_cents is null or intro_price_cents > 0),
  add column intro_months integer check (intro_months is null or intro_months > 0);

alter table public.subscription_agreements
  add column intro_price_cents bigint check (intro_price_cents is null or intro_price_cents > 0),
  add column intro_months integer check (intro_months is null or intro_months > 0);

comment on column public.subscription_agreements.intro_price_cents is
  'Preço da oferta de entrada na periodicidade contratada, congelado. price_cents é o que se paga depois.';

-- ---------------------------------------------------------------------------
-- record_subscription_agreement — igual à de 20261007121000, mais a oferta
-- ---------------------------------------------------------------------------

create or replace function public.record_subscription_agreement(p_subscription_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_plan record;
  v_price bigint;
  v_addons jsonb;
  v_provider jsonb;
  v_acceptance record;
  v_doc record;
  v_last record;
  v_id uuid;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if v_sub.id is null then
    return null;
  end if;

  if v_sub.plan_id is null then
    return null;
  end if;

  select * into v_plan from public.plans where id = v_sub.plan_id;
  if v_plan.id is null then
    return null;
  end if;

  v_price := case when v_sub.interval = 'month'
                  then v_plan.price_month_cents
                  else v_plan.price_year_cents end;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'slug', a.slug,
               'name', a.name,
               'priceCents', case when sa.interval = 'month'
                                  then a.price_month_cents
                                  else a.price_year_cents end
             )
             order by a.name
           ),
           '[]'::jsonb
         )
    into v_addons
  from public.subscription_addons sa
  join public.addons a on a.id = sa.addon_id
  where sa.subscription_id = p_subscription_id
    and sa.status in ('active', 'trialing');

  select coalesce(
           jsonb_object_agg(
             replace(key, 'company_', ''),
             value
           ) filter (where key like 'company_%'),
           '{}'::jsonb
         )
    into v_provider
  from public.app_settings;

  select ta.* into v_acceptance
  from public.terms_acceptances ta
  where ta.profile_id = v_sub.profile_id
    and (v_sub.terms_document_id is null or ta.document_id = v_sub.terms_document_id)
  order by ta.accepted_at desc
  limit 1;

  select * into v_doc from public.legal_documents where id = v_sub.terms_document_id;

  select * into v_last
  from public.subscription_agreements
  where subscription_id = p_subscription_id
  order by celebrated_at desc
  limit 1;

  if v_last.id is not null
     and v_last.plan_id is not distinct from v_sub.plan_id
     and v_last.price_cents = v_price
     and v_last.interval = v_sub.interval
     and v_last.minimum_commitment_months is not distinct from v_sub.minimum_commitment_months
     and v_last.terms_version is not distinct from v_sub.terms_version
     and v_last.addons = v_addons
     and v_last.intro_price_cents is not distinct from v_sub.intro_price_cents
     and v_last.intro_months is not distinct from v_sub.intro_months
  then
    return v_last.id;
  end if;

  insert into public.subscription_agreements (
    subscription_id, profile_id, reference, celebrated_at,
    plan_id, plan_name, plan_features, plan_limits, addons,
    price_cents, price_month_cents, price_year_cents, interval,
    intro_price_cents, intro_months,
    minimum_commitment_months, commitment_ends_at,
    terms_document_id, terms_version, terms_content_hash,
    terms_accepted_at, terms_accepted_ip,
    provider, supersedes_id
  ) values (
    p_subscription_id, v_sub.profile_id, public.next_agreement_reference(),
    coalesce(v_sub.started_at, now()),
    v_plan.id, v_plan.name, v_plan.features, v_plan.limits, v_addons,
    v_price, v_plan.price_month_cents, v_plan.price_year_cents, v_sub.interval,
    v_sub.intro_price_cents, v_sub.intro_months,
    v_sub.minimum_commitment_months, v_sub.commitment_ends_at,
    v_sub.terms_document_id, v_sub.terms_version, v_doc.content_hash,
    v_acceptance.accepted_at, v_acceptance.ip,
    v_provider, v_last.id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_subscription_agreement(uuid) from anon, authenticated;
