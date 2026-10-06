-- ---------------------------------------------------------------------------
-- Quem fica acima do limite quando o Admin o baixa (D40)
-- ===========================================================================
-- 04 §8.5 deixa o Admin editar os limites de um plano, e nada o avisava de que
-- havia subscritores a usar mais do que o limite novo. Quem tivesse 8 imóveis
-- num plano que passasse a dar 5 ficava em excedente **sem aviso a ninguém** —
-- nem ao Admin que carregou em Guardar, nem ao cliente.
--
-- Decisão do cliente a 6 out 2026: **avisar e deixar em excedente.** O modal
-- diz quantas contas ficam acima de cada limite e pede confirmação; ao
-- confirmar, grava e os excedentes mantêm-se, como num downgrade de 02 §5 —
-- ficam a ler e a usar o que têm, e nada é apagado. `apply_plan_downgrade`
-- continua a existir e **não** é disparado daqui: passar o conteúdo de um
-- cliente a rascunho sem ele ter feito nada era a opção que foi recusada.
--
-- Só `cloud_gb` fica de fora desta conta: a Cloud acima da quota já tem regra
-- própria e mais suave em 07 §19.8 #7 (fica só de leitura, nada se apaga), e
-- medir bytes por conta aqui era repetir `cloud_status` com outro nome.
-- ---------------------------------------------------------------------------

create or replace function public.plan_limit_overage(p_plan_id uuid, p_limits jsonb)
returns table (limit_key text, affected bigint, max_used bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text;
  v_limit bigint;
begin
  if not public.is_admin() then
    raise exception 'apenas o admin' using errcode = '42501';
  end if;

  foreach v_key in array array['active_properties', 'visits', 'active_chats', 'saved', 'alerts']
  loop
    -- Chave ausente ou `null` é ILIMITADO (07 §19.2): não há como ficar acima.
    if p_limits ? v_key and jsonb_typeof(p_limits -> v_key) = 'number' then
      v_limit := (p_limits ->> v_key)::bigint;

      return query
      with usage as (
        select public.plan_usage(s.profile_id, v_key) as used
        from public.subscriptions s
        where s.plan_id = p_plan_id
          and s.status in ('active', 'trialing')
      )
      select v_key, count(*)::bigint, coalesce(max(usage.used), 0)::bigint
      from usage
      where usage.used > v_limit
      having count(*) > 0;
    end if;
  end loop;
end;
$$;

revoke execute on function public.plan_limit_overage(uuid, jsonb) from public;
grant execute on function public.plan_limit_overage(uuid, jsonb) to authenticated;

comment on function public.plan_limit_overage(uuid, jsonb) is
  'D40 — contas de um plano que ficariam acima de cada limite candidato. '
  'Só leitura: avisa, não corrige. cloud_gb fica de fora (07 §19.8 #7).';
