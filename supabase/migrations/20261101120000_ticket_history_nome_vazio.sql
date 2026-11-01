-- ---------------------------------------------------------------------------
-- ticket_history — um nome vazio passa a "—" (corrige 20261007140000)
-- ---------------------------------------------------------------------------
-- O staff vê quem mexeu em cada ticket; quando não há nome, a intenção era
-- mostrar "—". A versão de 7 out escrevia `coalesce(p.full_name, '—')` — mas
-- `profiles.full_name` é `not null default ''`, e a eliminação de conta
-- (P9-06) também o põe a `''`. O `coalesce` só troca `null`, por isso o "—"
-- nunca aparecia: o Suporte via um nome em branco, e não sabia se era falta de
-- nome ou falha de leitura. Foi o `support-rls.test.ts` que o mostrou, a 1 nov,
-- na primeira corrida contra a base real.
--
-- `nullif(btrim(...), '')` trata o vazio e o só-espaços como ausência.
-- Passa também a `search_path = ''`, com tudo qualificado.
-- ---------------------------------------------------------------------------

create or replace function public.ticket_history(p_ticket_id uuid)
returns table (
  status_from public.ticket_status,
  status_to public.ticket_status,
  note text,
  actor_name text,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_staff boolean := public.is_staff();
  v_is_reporter boolean;
begin
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id and t.reporter_id = auth.uid()
  ) into v_is_reporter;

  if not (v_is_staff or v_is_reporter) then
    raise exception 'not_allowed' using hint = 'not_allowed';
  end if;

  return query
  select
    e.status_from,
    e.status_to,
    e.note,
    -- Quem reportou **não** vê o nome de quem mexeu no ticket: saber que foi
    -- a "Ana" a fechar o seu bug não lhe serve de nada e é dado de um
    -- trabalhador. O staff vê, porque é o seu registo de trabalho.
    case
      when v_is_staff then coalesce(nullif(btrim(p.full_name), ''), '—')
      else null
    end as actor_name,
    e.occurred_at
  from public.ticket_events e
  left join public.profiles p on p.id = e.actor_id
  where e.ticket_id = p_ticket_id
  order by e.occurred_at;
end;
$$;
