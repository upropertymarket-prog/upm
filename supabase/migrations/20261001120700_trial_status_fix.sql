-- UProperty Market — Fase 7, correção a `trial_status` (P7-06)
--
-- A versão anterior usava `trial_ends_at` sem qualificar dentro do `exists`, e
-- esse nome também é uma das colunas de saída da função: o PL/pgSQL não sabia
-- se era a variável ou a coluna e recusava com 42702. Apanhado pelo teste.

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
      select 1 from public.subscriptions s
      where s.profile_id = v_me and s.status = 'trialing' and s.trial_ends_at > now()
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
