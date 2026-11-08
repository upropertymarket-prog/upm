-- ===========================================================================
-- Quem se pré-inscreveu pode apagar a pré-inscrição (cliente, 8 nov 2026)
-- ===========================================================================
-- O e-mail de confirmação leva um segundo link, "remover a minha
-- pré-inscrição". O link abre `/pre-inscricao/remover`, e o botão dessa página
-- chama `remove_site_lead`, que apaga:
--
--   - o lead (`site_leads`): nome, e-mail, perfil, zona, consentimentos;
--   - as notas e mudanças da equipa sobre ele (`site_lead_events`, que o
--     prendia com `restrict`);
--   - os e-mails de confirmação na fila (`notification_deliveries`), que
--     guardam o endereço e o nome no `payload`.
--
-- No `audit_log` fica que um lead foi apagado a pedido, com o id e o
-- formulário — sem nome nem e-mail.
--
-- **Um token próprio, e não o de confirmação.** O de confirmação apaga-se ao
-- confirmar (`confirm_site_lead`); o de remoção tem de servir antes e depois.
-- Guarda-se só o hash, como o outro. Cada submissão do formulário gera um
-- novo (a pré-inscrição é a mesma, deduplicada por e-mail); o e-mail anterior
-- ainda em fila é cancelado pela action, e o seu link deixa de servir.
--
-- **O `anon` chama-a**, como a `confirm_site_lead`: quem pede não tem conta,
-- e o token é a identidade — só quem recebeu o e-mail o tem (32 bytes, só o
-- hash na base). O site chama-a num `POST`, nunca ao abrir o link, que os
-- antivírus e os clientes de e-mail abrem sozinhos. Está em `ANON_PERMITIDAS`
-- (`packages/db/src/superficie-anon.test.ts`).
-- ===========================================================================

alter table public.site_leads
  add column removal_token_hash text;

create unique index site_leads_removal_token_hash_idx
  on public.site_leads (removal_token_hash)
  where removal_token_hash is not null;

comment on column public.site_leads.removal_token_hash is
  'sha256 (hex) do token do link "remover a minha pré-inscrição" (8 nov 2026). Serve antes e depois de confirmar.';

create or replace function public.remove_site_lead(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_lead public.site_leads%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select * into v_lead from public.site_leads where removal_token_hash = v_hash;
  if not found then
    return false;
  end if;

  delete from public.notification_deliveries
  where recipient = v_lead.email
    and template = 'site_lead_confirmation';
  delete from public.site_lead_events where lead_id = v_lead.id;
  delete from public.site_leads where id = v_lead.id;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (
    null,
    'site_lead.removed_by_request',
    'site_leads',
    v_lead.id,
    jsonb_build_object('form', v_lead.form, 'source', v_lead.source)
  );

  return true;
end;
$$;

revoke all on function public.remove_site_lead(text) from public, authenticated;
grant execute on function public.remove_site_lead(text) to anon, service_role;

comment on function public.remove_site_lead(text) is
  'Apaga a pré-inscrição de quem tem o link do e-mail (8 nov 2026). anon: o token é a identidade.';
