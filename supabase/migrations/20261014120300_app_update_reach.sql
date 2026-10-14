-- ---------------------------------------------------------------------------
-- O alcance conta-se no Postgres, não na app (P10-07, correção)
--
-- `appUpdateReach` em `packages/db/src/updates.ts` trazia **todas** as linhas
-- de `app_update_views` para a app e contava-as em JavaScript, com um
-- `limit(100000)` a segurar o pior caso. Funciona hoje — a tabela está vazia —
-- e deixa de funcionar exatamente quando o produto tiver sucesso: um ecrã do
-- Marketing que carrega uma linha por pessoa por novidade, e que a partir de
-- certo ponto passa a contar **errado em silêncio**, porque o `limit` corta e
-- ninguém avisa. É a mesma figura de D47, registada na Fase 8.
--
-- Um `count(*) ... group by` resolve-o com uma linha por novidade, e o índice
-- `app_update_views_by_update_idx` já existe para o servir.
--
-- `security definer` com `is_marketing()` lá dentro: o alcance é agregado, mas
-- é agregado sobre quem leu o quê, e essa é uma leitura do Marketing. Uma
-- policy não servia aqui — a função devolve contagens, não linhas.
-- ---------------------------------------------------------------------------

create or replace function public.app_update_reach()
returns table (update_id uuid, seen integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing lê o alcance das atualizações.' using errcode = '42501';
  end if;

  return query
  select v.update_id, count(*)::integer
    from public.app_update_views v
   group by v.update_id;
end;
$$;

comment on function public.app_update_reach() is
  'P10-07: quantas pessoas viram cada atualização. Agregado no Postgres — a app não traz uma linha por leitura.';

revoke all on function public.app_update_reach() from public, anon;
grant execute on function public.app_update_reach() to authenticated;
