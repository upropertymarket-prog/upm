-- UProperty Market — Fase 9, 5/6
--
-- P9-06 — eliminação de conta com retenção separada. Fecha a metade de D25 que
-- faltava: a "Zona de perigo" de `/definicoes` (04 §8.3, 02 §7.3).
--
-- A separação que P9-06 exige, e que esta migração torna explícita:
--
-- | Camada                        | O que lhe acontece                                  |
-- | ----------------------------- | --------------------------------------------------- |
-- | Estado da conta               | `profiles.status = 'deleted'`, sessão revogada      |
-- | Dados de gestão da subscrição | mantidos (`subscriptions`, `invoices`)              |
-- | Histórico de subscrições      | mantido (`subscription_events`), append-only        |
-- | Aceitação dos Termos          | mantida (`terms_acceptances`), é a prova do contrato|
-- | Dados a anonimizar            | nome, telefone, NIF, avatar, preferências           |
-- | Identidade permanente         | mantida em `person_identities`, só hashes           |
--
-- **O perfil não se apaga — esvazia-se.** Apagar a linha de `profiles` faria
-- `on delete cascade` em `subscriptions` e levava o histórico com ela, que é
-- exatamente o que P9-06 proíbe. O mesmo vale para `auth.users`: a app bane e
-- anonimiza o utilizador de autenticação, nunca o apaga.
--
-- **Nenhuma política de retenção é inventada aqui.** `retention_until` nasce a
-- null e a chave de configuração também. O prazo depende da decisão (b) do
-- cliente de 7 out 2026 e da validação da base legal por quem revê os Termos.

set search_path = public, extensions;

insert into public.app_settings (key, value, public, description)
values (
  'account_deletion_retention_months',
  'null'::jsonb,
  false,
  'Meses de conservação dos identificadores após eliminação da conta. null = POR DEFINIR (P9-06)'
)
on conflict (key) do nothing;

create table public.account_deletions (
  id bigint generated always as identity primary key,
  -- Sem `on delete cascade`: se o perfil alguma vez for removido por outra via,
  -- o registo de que houve uma eliminação tem de ficar.
  profile_id uuid references public.profiles (id) on delete set null,
  person_identity_id uuid references public.person_identities (id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  reason text check (reason is null or length(btrim(reason)) <= 1000),
  -- O que foi efetivamente anonimizado e o que foi conservado, para a resposta
  -- a um pedido de titular não depender de memória de ninguém.
  anonymized jsonb not null default '{}'::jsonb,
  retained jsonb not null default '{}'::jsonb,
  -- null = prazo por definir. Uma purga futura filtra por aqui.
  retention_until timestamptz
);

create index account_deletions_profile_idx on public.account_deletions (profile_id);
create index account_deletions_identity_idx on public.account_deletions (person_identity_id);
create index account_deletions_retention_idx on public.account_deletions (retention_until)
  where retention_until is not null;

alter table public.account_deletions enable row level security;

create policy account_deletions_select_admin on public.account_deletions
  for select using (public.is_admin());

revoke all on public.account_deletions from anon, authenticated;
grant select on public.account_deletions to authenticated;
revoke all on sequence public.account_deletions_id_seq from anon, authenticated;

comment on table public.account_deletions is
  'Registo de eliminações de conta: o que foi anonimizado, o que foi conservado e até quando (P9-06).';

-- ---------------------------------------------------------------------------
-- export_own_account_data — a outra metade da "Zona de perigo" (02 §7.3)
--
-- Devolve o que é do titular, numa estrutura legível. Não devolve nada de
-- terceiros: as mensagens trazem o corpo e a data, não o perfil do outro lado.
-- ---------------------------------------------------------------------------

create or replace function public.export_own_account_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_out jsonb;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select jsonb_build_object(
        'full_name', p.full_name,
        'role', p.role,
        'phone', p.phone,
        'tax_id', p.tax_id,
        'locale', p.locale,
        'theme', p.theme,
        'status', p.status,
        'created_at', p.created_at,
        'preferences', p.preferences,
        'notification_prefs', p.notification_prefs
      ) from public.profiles p where p.id = v_me
    ),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plan', pl.name,
        'status', s.status,
        'interval', s.interval,
        'started_at', s.started_at,
        'current_period_end', s.current_period_end,
        'minimum_commitment_months', s.minimum_commitment_months,
        'commitment_ends_at', s.commitment_ends_at,
        'cancel_at_period_end', s.cancel_at_period_end,
        'canceled_at', s.canceled_at,
        'cancel_reason', s.cancel_reason,
        'terms_version', s.terms_version
      ) order by s.created_at)
      from public.subscriptions s
      left join public.plans pl on pl.id = s.plan_id
      where s.profile_id = v_me
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'number', i.number, 'total_cents', i.total_cents,
        'currency', i.currency, 'status', i.status, 'issued_at', i.issued_at
      ) order by i.issued_at)
      from public.invoices i where i.profile_id = v_me
    ), '[]'::jsonb),
    'terms_acceptances', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', a.document_kind, 'version', a.version,
        'content_hash', a.content_hash, 'context', a.context,
        'accepted_at', a.accepted_at
      ) order by a.accepted_at)
      from public.terms_acceptances a where a.profile_id = v_me
    ), '[]'::jsonb),
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', pr.ref, 'title', pr.title, 'status', pr.status,
        'deal', pr.deal, 'city', pr.city, 'created_at', pr.created_at
      ) order by pr.created_at)
      from public.properties pr where pr.owner_id = v_me
    ), '[]'::jsonb),
    'saved_properties', coalesce((
      select jsonb_agg(jsonb_build_object('property_ref', pr.ref, 'saved_at', sp.created_at)
                       order by sp.created_at)
      from public.saved_properties sp
      join public.properties pr on pr.id = sp.property_id
      where sp.user_id = v_me
    ), '[]'::jsonb),
    'search_alerts', coalesce((
      select jsonb_agg(jsonb_build_object('filters', sa.filters, 'created_at', sa.created_at)
                       order by sa.created_at)
      from public.search_alerts sa where sa.user_id = v_me
    ), '[]'::jsonb),
    'messages_sent', coalesce((
      select jsonb_agg(jsonb_build_object('body', m.body, 'sent_at', m.created_at)
                       order by m.created_at)
      from public.messages m where m.sender_id = v_me
    ), '[]'::jsonb),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.name, 'size', f.size, 'created_at', f.created_at)
                       order by f.created_at)
      from public.files f where f.owner_id = v_me
    ), '[]'::jsonb)
  ) into v_out;

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (v_me, 'account.export_requested', 'profiles', v_me);

  return v_out;
end;
$$;

grant execute on function public.export_own_account_data() to authenticated;

comment on function public.export_own_account_data() is
  'Exportação dos dados do titular (02 §7.3, D25). Nada de dados de terceiros.';

-- ---------------------------------------------------------------------------
-- delete_own_account — anonimiza, conserva o que tem de ser conservado, e diz
-- exatamente o que fez de cada lado
--
-- Não cancela a subscrição no Stripe: isso é da camada de aplicação, que o faz
-- a seguir. A base de dados não fala com o Stripe, e uma função que o tentasse
-- fazer deixava a conta a meio se a chamada falhasse.
-- ---------------------------------------------------------------------------

create or replace function public.delete_own_account(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_identity uuid;
  v_retention_months jsonb;
  v_retention_until timestamptz;
  v_archived integer := 0;
  v_id bigint;
begin
  if v_me is null then
    raise exception 'Sem sessão' using errcode = '42501';
  end if;

  select person_identity_id into v_identity from public.profiles where id = v_me;

  if (select status from public.profiles where id = v_me) = 'deleted' then
    raise exception 'Conta já eliminada' using errcode = '22023';
  end if;

  -- O prazo de retenção vem da configuração. null = não configurado, e então
  -- a linha fica sem prazo — nunca se inventa um aqui.
  select value into v_retention_months from public.app_settings
   where key = 'account_deletion_retention_months';

  if v_retention_months is not null and jsonb_typeof(v_retention_months) = 'number' then
    v_retention_until := now() + ((v_retention_months #>> '{}') || ' months')::interval;
  end if;

  -- Anúncios visíveis ao público saem do ar. Não são apagados: ficam
  -- `archived`, pela mesma regra dos excedentes de 02 §5 ("nunca apagados").
  update public.properties
     set status = 'archived'
   where owner_id = v_me
     and status in ('active', 'featured', 'pending_review');
  get diagnostics v_archived = row_count;

  -- Anonimização do perfil. A linha fica, para o histórico não ficar órfão.
  update public.profiles
     set status = 'deleted',
         full_name = '',
         phone = null,
         tax_id = null,
         avatar_path = null,
         preferences = '{}'::jsonb,
         notification_prefs = '{}'::jsonb
   where id = v_me;

  if v_identity is not null then
    update public.person_identities
       set last_account_deleted_at = now(),
           retention_until = v_retention_until
     where id = v_identity;
  end if;

  insert into public.account_deletions (
    profile_id, person_identity_id, reason, completed_at,
    anonymized, retained, retention_until
  )
  values (
    v_me, v_identity, nullif(btrim(coalesce(p_reason, '')), ''), now(),
    jsonb_build_object(
      'profile_fields', jsonb_build_array('full_name', 'phone', 'tax_id', 'avatar_path',
                                          'preferences', 'notification_prefs'),
      'properties_archived', v_archived
    ),
    jsonb_build_object(
      'subscriptions', true,
      'subscription_events', true,
      'invoices', true,
      'terms_acceptances', true,
      'person_identity_hashes', v_identity is not null,
      'legal_basis_validated', false
    ),
    v_retention_until
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (
    v_me, 'account.deleted', 'profiles', v_me,
    jsonb_build_object('deletion_id', v_id, 'properties_archived', v_archived,
                       'retention_until', v_retention_until)
  );

  return jsonb_build_object(
    'deletion_id', v_id,
    'properties_archived', v_archived,
    'retention_until', v_retention_until
  );
end;
$$;

grant execute on function public.delete_own_account(text) to authenticated;

comment on function public.delete_own_account(text) is
  'Eliminação da conta com retenção separada (P9-06). Anonimiza o perfil e conserva '
  'subscrições, faturas e aceitações. retention_until vem de app_settings; null = por definir.';

-- ---------------------------------------------------------------------------
-- O login de uma conta eliminada não entra — mesma porta das suspensas
--
-- 20261002130000 fechou o início de sessão às contas `suspended`. Uma conta
-- eliminada tem de cair na mesma rede, senão a anonimização é cosmética.
-- ---------------------------------------------------------------------------

create or replace function public.account_blocked(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status in ('suspended', 'deleted') from public.profiles where id = p_profile_id),
    false
  );
$$;

grant execute on function public.account_blocked(uuid) to anon, authenticated;

comment on function public.account_blocked(uuid) is
  'Conta sem direito a sessão: suspensa ou eliminada (P8-02, P9-06).';
