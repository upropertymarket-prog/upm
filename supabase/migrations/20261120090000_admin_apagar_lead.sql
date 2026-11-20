-- ===========================================================================
-- Um admin pode apagar um lead (cliente, 20 nov 2026)
-- ===========================================================================
-- Até aqui um lead só saía pela retenção (`purge_unconfirmed_site_leads`, 12
-- meses sem atividade) ou pelo link "remover a minha pré-inscrição"
-- (`remove_site_lead`). Faltava a porta da equipa: quem pede por telefone ou
-- por e-mail para ser apagado, um lead de teste, um duplicado.
--
-- Apaga o mesmo que `remove_site_lead`, pela mesma ordem:
--
--   - os e-mails de confirmação em fila (`notification_deliveries`), que
--     guardam o endereço e o nome no `payload`;
--   - as notas e mudanças da equipa (`site_lead_events`, que prendem o lead
--     com `restrict`);
--   - o lead.
--
-- **Pede o PIN** (`require_step_up`), como a exportação: é irreversível, e a
-- confirmação no modal é para o engano, não para a sessão deixada aberta.
--
-- No `audit_log` fica quem apagou, o id, o formulário e a origem — sem nome
-- nem e-mail, que era precisamente o que se queria apagar. As cópias diárias
-- (exportação CSV) estão fora do sistema; tirar delas a pessoa continua a ser
-- um passo manual de quem as guarda.
-- ===========================================================================

create or replace function public.admin_delete_site_lead(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.site_leads%rowtype;
begin
  perform public.require_step_up();
  if not public.is_admin() then
    raise exception 'Sem permissao' using errcode = '42501';
  end if;

  select * into v_lead from public.site_leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead nao encontrado' using errcode = 'P0002';
  end if;

  delete from public.notification_deliveries
  where recipient = v_lead.email
    and template = 'site_lead_confirmation';
  delete from public.site_lead_events where lead_id = v_lead.id;
  delete from public.site_leads where id = v_lead.id;

  perform public.write_audit_log(
    'site_lead.deleted',
    'site_leads',
    v_lead.id,
    jsonb_build_object('form', v_lead.form, 'source', v_lead.source, 'status', v_lead.status)
  );
end;
$$;

revoke all on function public.admin_delete_site_lead(uuid) from public, anon;
grant execute on function public.admin_delete_site_lead(uuid) to authenticated;

comment on function public.admin_delete_site_lead(uuid) is
  'Admin apaga um lead do site, com PIN (20 nov 2026). Leva eventos e e-mails de confirmação em fila.';
