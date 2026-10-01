-- UProperty Market — Fase 7 (Faturação), P7-05
--
-- Métricas de Admin › Planos (04 §8.5). Agregadas em SQL, não no servidor:
-- 08 §4.5 proíbe N+1 e §4.7 manda pré-agregar as contagens caras. A página faz
-- duas chamadas, independentemente de quantos planos e subscrições existam.
--
-- `security definer` + verificação de papel lá dentro: estas funções leem
-- subscrições de toda a gente, por isso não podem ser chamáveis por quem não
-- é staff — a RLS de `subscriptions` já o impediria, mas uma função definer
-- contorna-a, e é por isso que a verificação tem de estar aqui.

/**
 * MRR mensalizado: uma subscrição anual contribui com um doze avos por mês.
 * É a convenção de SaaS e é a única forma de somar mensais com anuais sem
 * dar um número que salta de mês para mês.
 */
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
          when s.interval = 'month' then p.price_month_cents
          else round(p.price_year_cents / 12.0)
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

/**
 * Os números do topo da página. `churn_30d` é a razão entre o que cancelou
 * nos últimos 30 dias e o que estava ativo no início desse período — uma
 * aproximação honesta com os dados que temos, e documentada como tal na UI.
 */
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
        when s.interval = 'month' then p.price_month_cents
        else round(p.price_year_cents / 12.0)
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

/**
 * Faturação recente, com o nome de quem pagou. A RLS de `invoices` já deixa o
 * staff ler tudo, mas a de `profiles` não lhe dá o nome sem alargar a policy —
 * mesmo raciocínio das listas da Fase 5: devolve-se só a coluna que o contexto
 * implica, em vez de abrir `profiles` a mais gente.
 */
create or replace function public.admin_recent_invoices(p_limit integer default 20)
returns table (
  id uuid,
  number text,
  total_cents bigint,
  status text,
  issued_at timestamptz,
  client_name text,
  plan_name text
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
    i.id,
    i.number,
    i.total_cents,
    i.status,
    i.issued_at,
    coalesce(nullif(btrim(pr.full_name), ''), 'Conta sem nome'),
    p.name
  from public.invoices i
  join public.profiles pr on pr.id = i.profile_id
  left join public.subscriptions s on s.id = i.subscription_id
  left join public.plans p on p.id = s.plan_id
  order by i.issued_at desc nulls last
  limit least(greatest(p_limit, 1), 100);
end;
$$;
