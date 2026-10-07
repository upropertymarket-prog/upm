-- ---------------------------------------------------------------------------
-- A notificação do ticket apontava para uma rota que não existe (P10-02)
-- ===========================================================================
-- `20261007140000` pôs `'/meus-reports?ticket=' || id` no link da notificação.
-- A rota chama-se **`/reports`**: é o que está em `apps/app/src/lib/navigation.ts`
-- desde a Fase 1 (`REPORTS.href = '/reports'`, id `myReports`), e é por aí que
-- o item da sidebar leva o utilizador. "Os meus reports" é o **nome** do ecrã
-- em 04 §2.3, não o caminho.
--
-- Era um 404 silencioso e do pior tipo: só aparecia a quem recebesse a
-- notificação, ou seja, a quem já tinha reportado um problema — a última
-- pessoa a quem se quer dar um segundo erro. Nada no `typecheck` ou no `build`
-- o apanharia, porque o caminho é uma string dentro de uma função SQL.
--
-- Migração nova e não reescrita, por 07 §20.7. O resto do corpo é igual ao de
-- `20261007140000`.
-- ---------------------------------------------------------------------------

create or replace function public.set_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status,
  p_fix_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from public.ticket_status;
  v_reporter uuid;
  v_ref text;
  v_note text := nullif(trim(p_fix_note), '');
begin
  if not coalesce(
    (select role = 'support' from public.profiles where id = v_actor), false
  ) then
    raise exception 'not_support' using hint = 'not_support';
  end if;

  select status, reporter_id, ref
  into v_from, v_reporter, v_ref
  from public.tickets
  where id = p_ticket_id;

  if v_from is null then
    raise exception 'ticket_not_found' using hint = 'ticket_not_found';
  end if;

  if p_status = 'closed' and v_note is null then
    raise exception 'fix_note_required' using hint = 'fix_note_required';
  end if;

  update public.tickets
  set status = p_status,
      fix_note = coalesce(v_note, fix_note),
      updated_at = now()
  where id = p_ticket_id;

  insert into public.ticket_events (ticket_id, status_from, status_to, note, actor_id)
  values (p_ticket_id, v_from, p_status, v_note, v_actor);

  if v_reporter is not null and v_reporter <> v_actor and v_from is distinct from p_status then
    perform public.notify(
      v_reporter,
      'ticket_update',
      case p_status
        when 'triage' then 'O seu relato está em análise'
        when 'in_progress' then 'Estamos a corrigir o seu relato'
        when 'awaiting_confirmation' then 'A correção do seu relato está em teste'
        when 'closed' then 'O seu relato está resolvido'
        else 'O seu relato foi atualizado'
      end,
      coalesce(v_note, 'Referência ' || v_ref || '.'),
      '/reports?ticket=' || p_ticket_id::text,
      'ticket:' || p_ticket_id::text
    );
  end if;
end;
$$;

revoke execute on function public.set_ticket_status(uuid, public.ticket_status, text)
  from public, anon;
grant execute on function public.set_ticket_status(uuid, public.ticket_status, text)
  to authenticated;
