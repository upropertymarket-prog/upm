-- MRR com a oferta do 1.º ano — 14 nov 2026
-- =========================================================================
-- `admin_plan_metrics` e `admin_billing_summary` somavam o preço NORMAL do
-- plano para toda a gente. Com a oferta de `20261113090000`, um proprietário
-- Essential paga 10,99 € nos primeiros 12 meses e o Admin contava 19,99 € —
-- quase o dobro. O MRR é dinheiro que entra, não dinheiro que entrará.
--
-- A regra fica num sítio só, `subscription_mrr_cents`, e as duas funções
-- passam a chamá-la: era a mesma expressão copiada nas duas, e a cópia é o
-- que deixa uma delas para trás na próxima mudança.
--
-- A oferta lê-se da SUBSCRIÇÃO (`intro_price_cents`, `intro_months`), que a
-- congela no Checkout, e nunca de `plans`: o Admin pode tirar a oferta amanhã
-- e quem a apanhou continua a pagá-la.

create or replace function public.subscription_mrr_cents(
  p_interval text,
  p_started_at timestamptz,
  p_intro_price_cents bigint,
  p_intro_months integer,
  p_price_month_cents bigint,
  p_price_year_cents bigint
)
returns bigint
language sql
stable
set search_path = public
as $$
  select case
    -- Ainda dentro da oferta: o preço que a pessoa está de facto a pagar.
    when p_intro_price_cents is not null
         and p_intro_months is not null
         and now() < p_started_at + make_interval(months => p_intro_months)
      then case when p_interval = 'month'
                then p_intro_price_cents
                else round(p_intro_price_cents / 12.0)::bigint end
    -- Mensalizado: o anual contribui com um doze avos (convenção de SaaS,
    -- 20261001120500).
    when p_interval = 'month' then p_price_month_cents
    else round(p_price_year_cents / 12.0)::bigint
  end;
$$;

revoke all on function public.subscription_mrr_cents(text, timestamptz, bigint, integer, bigint, bigint)
  from public, anon, authenticated;

comment on function public.subscription_mrr_cents(text, timestamptz, bigint, integer, bigint, bigint) is
  'Contribuição mensal de uma subscrição para o MRR: o preço da oferta enquanto dura, depois o do plano.';

create or replace function public.admin_plan_metrics()
returns table (
  plan_id uuid,
  slug text,
  name text,
  audience public.plan_audience,
  price_month_cents bigint,
  price_year_cents bigint,
  visible boolean,
  subscribers bigint,
  mrr_cents bigint
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
    p.slug,
    p.name,
    p.audience,
    p.price_month_cents,
    p.price_year_cents,
    p.visible,
    count(s.id) filter (where s.status in ('active', 'trialing')),
    coalesce(
      sum(
        case
          when s.status not in ('active', 'trialing') then 0
          else public.subscription_mrr_cents(
            s.interval, coalesce(s.started_at, s.created_at),
            s.intro_price_cents, s.intro_months,
            p.price_month_cents, p.price_year_cents
          )
        end
      ),
      0
    )::bigint
  from public.plans p
  left join public.subscriptions s on s.plan_id = p.id
  group by p.id
  order by p.audience, p."position";
end;
$$;

create or replace function public.admin_billing_summary()
returns table (
  mrr_cents bigint,
  subscribers bigint,
  trials bigint,
  past_due bigint,
  canceled_30d bigint,
  new_30d bigint,
  addon_subscribers bigint
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
    coalesce(sum(
      case
        when s.status not in ('active', 'trialing') then 0
        else public.subscription_mrr_cents(
          s.interval, coalesce(s.started_at, s.created_at),
          s.intro_price_cents, s.intro_months,
          p.price_month_cents, p.price_year_cents
        )
      end
    ), 0)::bigint,
    count(*) filter (where s.status = 'active'),
    count(*) filter (where s.status = 'trialing'),
    count(*) filter (where s.status = 'past_due'),
    count(*) filter (where s.status = 'canceled' and s.updated_at >= now() - interval '30 days'),
    count(*) filter (where s.created_at >= now() - interval '30 days'),
    (
      select count(*)
      from public.subscription_addons sa
      where sa.status in ('active', 'trialing')
    )
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id;
end;
$$;
