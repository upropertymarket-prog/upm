-- ---------------------------------------------------------------------------
-- `submit_site_lead` e `confirm_site_lead` não alcançavam o pgcrypto (P2-02)
-- ===========================================================================
-- `pnpm gate:db`, corrido **depois** do push, devolveu dois erros:
--
--   function gen_random_bytes(integer) does not exist
--   function digest(text, unknown) does not exist
--
-- Num projeto Supabase o pgcrypto vive no schema `extensions`, não em
-- `public`. As duas funções foram criadas com `set search_path = public`, e
-- com isso deixaram de o ver. Criaram-se sem reclamar e **rebentariam na
-- primeira submissão do formulário** — a primeira pré-inscrição real do site.
--
-- O projeto já conhecia esta armadilha: `20261007120000_account_identity.sql`
-- e `20261007120100_legal_terms.sql` têm a nota no cabeçalho e usam
-- `set search_path = public, extensions`. Eu não a segui. É a terceira vez
-- nesta fase que o `gate:db` apanha algo que nem o `typecheck` nem o `build`
-- veriam, e todas as três pela mesma razão: correu depois de aplicar.
--
-- Migração nova e não reescrita (07 §20.7). O corpo das funções é idêntico ao
-- de `20261007150100`; o que muda é a linha do `search_path`.
-- ---------------------------------------------------------------------------

create or replace function public.submit_site_lead(
  p_form text,
  p_name text,
  p_email text,
  p_profile_type text,
  p_phone text default null,
  p_reason text default null,
  p_message text default null,
  p_consent_marketing boolean default false,
  p_utm jsonb default '{}'::jsonb,
  p_honeypot text default null,
  p_ip text default null
)
returns table (lead_id uuid, confirm_token text, already_confirmed boolean)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_hash text;
  v_existing public.site_leads%rowtype;
  v_mode text;
  v_source text;
begin
  if coalesce(btrim(p_honeypot), '') <> '' then
    return query select null::uuid, null::text, false;
    return;
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using hint = 'invalid_email';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'name_required' using hint = 'name_required';
  end if;
  if p_form not in ('preinscricao', 'contacto', 'empresas') then
    raise exception 'invalid_form' using hint = 'invalid_form';
  end if;
  if p_profile_type not in ('owner', 'buyer', 'empresa') then
    raise exception 'invalid_profile_type' using hint = 'invalid_profile_type';
  end if;

  if p_ip is not null and btrim(p_ip) <> '' then
    if not public.check_submission_rate_limit(p_ip, 'site_lead', 5) then
      raise exception 'rate_limited' using hint = 'rate_limited';
    end if;
    insert into public.auth_attempts (identifier, kind, succeeded)
    values (lower(p_ip), 'site_lead', true);
  end if;

  select value #>> '{}' into v_mode from public.feature_flags where key = 'launch_mode';
  v_source := case when v_mode = 'post' then 'post_launch' else 'pre_launch' end;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  select * into v_existing
  from public.site_leads
  where lower(email) = v_email and form = p_form
  order by created_at desc
  limit 1;

  if v_existing.id is not null then
    if v_existing.confirmed_at is not null then
      return query select v_existing.id, null::text, true;
      return;
    end if;

    update public.site_leads
    set name = btrim(p_name),
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        reason = nullif(btrim(coalesce(p_reason, '')), ''),
        message = nullif(btrim(coalesce(p_message, '')), ''),
        profile_type = p_profile_type,
        utm = coalesce(p_utm, '{}'::jsonb),
        confirm_token_hash = v_hash,
        updated_at = now()
    where id = v_existing.id;

    return query select v_existing.id, v_token, false;
    return;
  end if;

  insert into public.site_leads (
    source, form, name, email, phone, profile_type, reason, message, utm,
    consent_marketing, consent_at, confirm_token_hash
  )
  values (
    v_source, p_form, btrim(p_name), v_email,
    nullif(btrim(coalesce(p_phone, '')), ''), p_profile_type,
    nullif(btrim(coalesce(p_reason, '')), ''),
    nullif(btrim(coalesce(p_message, '')), ''),
    coalesce(p_utm, '{}'::jsonb),
    coalesce(p_consent_marketing, false),
    case when coalesce(p_consent_marketing, false) then now() else null end,
    v_hash
  )
  returning id into v_existing.id;

  return query select v_existing.id, v_token, false;
end;
$$;

revoke all on function public.submit_site_lead(
  text, text, text, text, text, text, text, boolean, jsonb, text, text
) from public;
grant execute on function public.submit_site_lead(
  text, text, text, text, text, text, text, boolean, jsonb, text, text
) to anon, authenticated;

create or replace function public.confirm_site_lead(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_id uuid;
begin
  select id into v_id from public.site_leads where confirm_token_hash = v_hash;
  if v_id is null then
    return false;
  end if;

  update public.site_leads
  set confirmed_at = coalesce(confirmed_at, now()),
      confirm_token_hash = null,
      updated_at = now()
  where id = v_id;

  return true;
end;
$$;

revoke all on function public.confirm_site_lead(text) from public;
grant execute on function public.confirm_site_lead(text) to anon, authenticated;
