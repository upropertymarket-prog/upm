-- UProperty Market — Fase 6, correção à parte 2/3 e 3/3
--
-- Bug apanhado pelo teste "código errado falha e conta como tentativa":
-- `resolve_file_share` gravava a tentativa falhada com `record_auth_attempt`
-- e logo a seguir fazia `raise exception`. O `raise` desfaz a transação
-- inteira — a gravação incluída. Resultado: `auth_attempts` ficava sempre
-- vazia, `check_auth_rate_limit` nunca via falha nenhuma, e o limite de
-- tentativas de 07 §19.8 não existia na prática. Um código de 4–6 dígitos
-- ficava aberto a força bruta, que é exatamente o que essa regra evitava.
--
-- Correção: o código errado deixa de ser exceção e passa a ser um resultado.
-- A função devolve `invalid_code = true` e a gravação da tentativa fica
-- comprometida, porque não há `raise` a desfazê-la.
--
-- Ficam a `raise` os casos em que não há nada a contar: token inexistente,
-- revogado ou expirado. Contá-los por `identifier = token` não protegeria de
-- nada — cada tentativa cega usa um token diferente, e o que se defende aqui
-- é o código de UM token já conhecido.
--
-- É a mesma divisão da Fase 3: quem decide é `check_auth_rate_limit`, quem
-- regista é `record_auth_attempt`, e nenhum dos dois vive dentro do caminho
-- que rebenta.

drop function if exists public.resolve_file_share(text, text);

create function public.resolve_file_share(p_token text, p_access_code_hash text default null)
returns table (
  share_id uuid,
  file_id uuid,
  file_name text,
  mime text,
  size bigint,
  permission public.share_permission,
  needs_code boolean,
  invalid_code boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.file_shares;
  v_limit jsonb;
begin
  v_limit := public.check_auth_rate_limit(p_token, 'share_code');
  if not (v_limit ->> 'allowed')::boolean then
    raise exception 'Demasiadas tentativas. Tente novamente mais tarde.' using errcode = '53400';
  end if;

  select * into v_share from public.file_shares
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_share.id is null then
    raise exception 'Ligação inválida ou expirada' using errcode = 'P0002';
  end if;

  if v_share.access_code_hash is not null then
    if p_access_code_hash is null then
      -- Primeiro ecrã: ainda não houve tentativa, só o pedido do código.
      return query select v_share.id, v_share.file_id, null::text, null::text,
        null::bigint, v_share.permission, true, false;
      return;
    end if;
    if p_access_code_hash <> v_share.access_code_hash then
      perform public.record_auth_attempt(p_token, 'share_code', false);
      return query select v_share.id, v_share.file_id, null::text, null::text,
        null::bigint, v_share.permission, true, true;
      return;
    end if;
  end if;

  perform public.record_auth_attempt(p_token, 'share_code', true);

  return query
    select v_share.id, f.id, f.name, f.mime, f.size, v_share.permission, false, false
    from public.files f
    where f.id = v_share.file_id and f.deleted_at is null;
end;
$$;

grant execute on function public.resolve_file_share(text, text) to anon, authenticated;

drop function if exists public.resolve_contract_share(text, text);

create function public.resolve_contract_share(
  p_token text,
  p_access_code_hash text default null
)
returns table (
  share_id uuid,
  contract_id uuid,
  title text,
  body jsonb,
  "values" jsonb,
  permission public.share_permission,
  needs_code boolean,
  invalid_code boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.contract_shares;
  v_limit jsonb;
begin
  v_limit := public.check_auth_rate_limit(p_token, 'share_code');
  if not (v_limit ->> 'allowed')::boolean then
    raise exception 'Demasiadas tentativas. Tente novamente mais tarde.' using errcode = '53400';
  end if;

  select * into v_share from public.contract_shares
  where token = p_token
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_share.id is null then
    raise exception 'Ligação inválida ou expirada' using errcode = 'P0002';
  end if;

  if v_share.access_code_hash is not null then
    if p_access_code_hash is null then
      return query select v_share.id, v_share.contract_id, null::text,
        null::jsonb, null::jsonb, v_share.permission, true, false;
      return;
    end if;
    if p_access_code_hash <> v_share.access_code_hash then
      perform public.record_auth_attempt(p_token, 'share_code', false);
      return query select v_share.id, v_share.contract_id, null::text,
        null::jsonb, null::jsonb, v_share.permission, true, true;
      return;
    end if;
  end if;

  perform public.record_auth_attempt(p_token, 'share_code', true);

  -- Devolve a VERSÃO CONGELADA, não o corpo atual (07 §13.2).
  return query
    select v_share.id, c.id, c.title, coalesce(cv.body, c.body),
      coalesce(cv."values", c."values"), v_share.permission, false, false
    from public.contracts c
    left join public.contract_versions cv on cv.id = v_share.version_id
    where c.id = v_share.contract_id;
end;
$$;

grant execute on function public.resolve_contract_share(text, text) to anon, authenticated;
