-- ---------------------------------------------------------------------------
-- O envio das campanhas (P10-08 · 04 §2.6 · 05 §1.9 · 07 §24.6)
--
-- A terceira e última parte de P10-08: a fila, a materialização dos
-- destinatários e as portas do `mail-worker`. O construtor e as escritas já
-- existem (`20261015090000` e `20261015120000`); o que faltava era sair.
--
-- ## A regra que molda o ficheiro: a lista nunca sai do Postgres
--
-- 07 §24.6 #5 diz que o Marketing recebe a **contagem** e não a lista. Isso tem
-- uma consequência que é fácil perder de vista: a materialização dos
-- destinatários **não pode** ser feita pela app, porque a app teria de ler os
-- endereços para os escrever. Por isso vive aqui, numa função `security
-- definer`: o `select` sobre `auth.users` e `site_leads` corre dentro do
-- Postgres, e o que atravessa a fronteira é um número.
--
-- O worker **pode** ver endereços — é ele que os entrega, e corre com a
-- `service_role`. A diferença não é de confiança, é de superfície: o worker é
-- um processo sem browser do outro lado.
--
-- ## Quem pode chamar o quê, e o guarda é o `grant`
--
-- As funções do worker não têm verificação de papel lá dentro: têm
-- `revoke ... from public, anon, authenticated` e `grant ... to service_role`,
-- que é o padrão de `mail_attachments_expired` (`20261014100000`). A chave é a
-- identidade. As duas do Marketing (`campaign_send_now`) e a anónima
-- (`campaign_unsubscribe`) são as que verificam por dentro, porque aí a
-- identidade não basta.
--
-- ## O que o renderizador faz, e onde
--
-- O HTML **não** se compõe em SQL. `renderCampaignHtml` (React Email) corre no
-- worker, por destinatário, porque é por destinatário que mudam as variáveis e
-- o `unsubscribe_token`. O que estas funções entregam são os ingredientes:
-- blocos, assunto, pré-cabeçalho, fundo, remetente e os três valores das
-- variáveis. Um segundo renderizador em PL/pgSQL seria a divergência garantida
-- que este projeto já evitou duas vezes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- As colunas que a fila precisa
--
-- `attempts` e `last_error` são a mesma figura de `notification_deliveries`: um
-- envio que falha cinco vezes pára de ser tentado, e para-se **com o motivo
-- escrito**. Uma fila que tenta para sempre um endereço inexistente bloqueia-se
-- a si própria e queima reputação de envio.
--
-- `materialized_at` em `campaign_emails` responde a uma pergunta que de outra
-- forma não tem resposta: *este e-mail da sequência já foi expandido em
-- destinatários?* Contar linhas não serve — uma audiência onde todos
-- cancelaram a subscrição expande-se para **zero** linhas, e sem esta marca a
-- campanha ficava em `sending` para sempre à espera de destinatários que nunca
-- vão existir.
-- ---------------------------------------------------------------------------

alter table public.campaign_recipients
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists last_error text;

alter table public.campaign_emails
  add column if not exists materialized_at timestamptz;

comment on column public.campaign_emails.materialized_at is
  'P10-08: quando este e-mail da sequência foi expandido em campaign_recipients. Nulo = ainda não. Contar linhas não serve: uma audiência vazia expande-se para zero.';

-- O índice da reclamação: o worker procura `pending` por ordem de criação.
create index if not exists campaign_recipients_pending_idx
  on public.campaign_recipients (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- campaign_materialize_recipients — onde a audiência passa a ser gente
--
-- O filtro é **o mesmo** de `campaign_audience_count()`, e tem de ser: um
-- número que não corresponde a quem recebe é pior do que nenhum número. As três
-- regras, por esta ordem: consentimento, supressões, conta viva.
--
-- `on conflict do nothing` sobre `(campaign_email_id, email)`: as leads do site
-- podem ter o mesmo endereço em duas linhas (dois formulários), e uma pessoa
-- não recebe o mesmo e-mail duas vezes por isso.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_materialize_recipients(p_campaign_email_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_audience public.campaign_audience;
  v_count integer;
begin
  select e.campaign_id, c.audience into v_campaign, v_audience
    from public.campaign_emails e
    join public.campaigns c on c.id = e.campaign_id
   where e.id = p_campaign_email_id;

  if not found then
    raise exception 'Este e-mail já não existe.' using errcode = 'P0002';
  end if;

  if v_audience in ('all', 'owners', 'buyers') then
    insert into public.campaign_recipients (campaign_id, campaign_email_id, email, profile_id)
    select v_campaign, p_campaign_email_id, lower(u.email), p.id
      from auth.users u
      join public.profiles p on p.id = u.id
     where u.email is not null
       and p.status = 'active'
       and p.marketing_consent
       and (
         v_audience = 'all' and p.role in ('buyer', 'owner')
         or (v_audience = 'owners' and p.role = 'owner')
         or (v_audience = 'buyers' and p.role = 'buyer')
       )
       and not exists (
         select 1 from public.email_suppressions s where s.email = lower(u.email)
       )
    on conflict (campaign_email_id, email) do nothing;
  else
    insert into public.campaign_recipients (campaign_id, campaign_email_id, email, profile_id)
    select v_campaign, p_campaign_email_id, lower(l.email), null
      from public.site_leads l
     where l.consent_marketing
       and l.source = case v_audience
         when 'site_leads_pre' then 'pre_launch'
         else 'post_launch'
       end
       and not exists (
         select 1 from public.email_suppressions s where s.email = lower(l.email)
       )
    on conflict (campaign_email_id, email) do nothing;
  end if;

  update public.campaign_emails
     set materialized_at = now()
   where id = p_campaign_email_id;

  select count(*) into v_count
    from public.campaign_recipients
   where campaign_email_id = p_campaign_email_id;

  -- A métrica da campanha é o total da sequência, recalculado: uma soma
  -- incremental fica errada no dia em que uma materialização correr duas vezes.
  update public.campaigns
     set recipients = (
       select count(*) from public.campaign_recipients r where r.campaign_id = v_campaign
     )
   where id = v_campaign;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.campaign_materialize_recipients(uuid) is
  'P10-08 · 07 §24.6 #5: expande a audiência em campaign_recipients DENTRO do Postgres. A app nunca lê os endereços — só o número que esta devolve.';

revoke all on function public.campaign_materialize_recipients(uuid) from public, anon, authenticated;
grant execute on function public.campaign_materialize_recipients(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- campaign_send_now — o botão "Enviar"
--
-- Não envia nada: põe a campanha em `sending` e materializa o **primeiro**
-- e-mail da sequência. Quem entrega é o worker, no ciclo seguinte. A separação
-- é a mesma de toda a fase: a app pede, o worker faz.
--
-- Os três `raise` antes de mexer no estado são os que impedem um envio que não
-- faz sentido — e cada um é uma pergunta que vale a pena ser respondida antes e
-- não depois: há remetente? há conteúdo em todos os e-mails? há alguém para
-- receber?
--
-- O último é o que mais vai disparar enquanto D69 não estiver pago: o
-- consentimento é opt-in e o registo ainda não o recolhe, logo as audiências de
-- registados dão zero. Dizê-lo aqui, com esta mensagem, é melhor do que marcar
-- uma campanha como enviada para ninguém.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_send_now(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
  v_sender uuid;
  v_incompletos integer;
  v_first uuid;
  v_count integer;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing envia campanhas.' using errcode = '42501';
  end if;

  select status, from_mailbox_id into v_status, v_sender
    from public.campaigns where id = p_id;

  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status in ('sending', 'sent') then
    raise exception 'Esta campanha já saiu.' using errcode = '42501';
  end if;
  if v_sender is null then
    raise exception 'Escolha o remetente antes de enviar.' using errcode = '22023';
  end if;

  select count(*) into v_incompletos
    from public.campaign_emails
   where campaign_id = p_id
     and (length(btrim(subject)) = 0 or jsonb_array_length(blocks) = 0);

  if v_incompletos > 0 then
    raise exception 'Há e-mails na sequência sem assunto ou sem blocos.' using errcode = '22023';
  end if;

  select id into v_first
    from public.campaign_emails where campaign_id = p_id order by position limit 1;

  if v_first is null then
    raise exception 'Esta campanha não tem e-mails.' using errcode = '22023';
  end if;

  v_count := public.campaign_materialize_recipients(v_first);

  if v_count = 0 then
    -- Desfaz a marca: a campanha fica em rascunho e tentável outra vez.
    update public.campaign_emails set materialized_at = null where id = v_first;
    raise exception 'Esta audiência não tem ninguém com consentimento de marketing.'
      using errcode = '22023';
  end if;

  update public.campaigns set status = 'sending' where id = p_id;

  return v_count;
end;
$$;

comment on function public.campaign_send_now(uuid) is
  'P10-08: põe a campanha em sending e materializa o 1.º e-mail. Quem entrega é o mail-worker — a app nunca fala com SMTP.';

revoke all on function public.campaign_send_now(uuid) from public, anon;
grant execute on function public.campaign_send_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- campaign_claim_recipients — a reclamação, com os ingredientes do e-mail
--
-- Reclamar e ler num só `round trip`, e é de propósito: o worker não pode ler
-- primeiro e marcar depois (duas passagens enviavam o mesmo e-mail duas vezes),
-- nem marcar primeiro e ler depois (precisava de uma segunda consulta pelos
-- mesmos ids). `for update skip locked` é o que faz duas passagens simultâneas
-- repartirem a fila em vez de esperarem uma pela outra.
--
-- As variáveis de 04 §2.6 saem daqui já resolvidas: o nome e o apelido partem
-- do `full_name` da conta ou do `name` da lead, e o plano vem de `plans`. O
-- worker não adivinha nada — se fosse ele a juntar isto, teria de ler
-- `profiles` e `plans` por destinatário, e a regra de onde vem cada variável
-- passava a estar em dois sítios.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_claim_recipients(p_limit integer default 25)
returns table (
  recipient_id uuid,
  campaign_id uuid,
  campaign_email_id uuid,
  email text,
  unsubscribe_token uuid,
  var_nome text,
  var_apelido text,
  var_plano text,
  subject text,
  preheader text,
  blocks jsonb,
  email_bg text,
  from_mailbox_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with alvos as (
    select r.id
      from public.campaign_recipients r
      join public.campaigns c on c.id = r.campaign_id
     where r.status = 'pending'
       and c.status = 'sending'
       and r.attempts < 5
     order by r.created_at
     limit greatest(coalesce(p_limit, 25), 1)
     for update of r skip locked
  ),
  reclamados as (
    update public.campaign_recipients r
       set status = 'sending', attempts = r.attempts + 1
      from alvos a
     where r.id = a.id
    returning r.id, r.campaign_id, r.campaign_email_id, r.email,
              r.unsubscribe_token, r.profile_id
  )
  select cl.id,
         cl.campaign_id,
         cl.campaign_email_id,
         cl.email,
         cl.unsubscribe_token,
         split_part(nome.completo, ' ', 1),
         coalesce(btrim(substr(nome.completo, nullif(strpos(nome.completo, ' '), 0) + 1)), ''),
         coalesce(pl.name, ''),
         e.subject,
         e.preheader,
         e.blocks,
         c.email_bg,
         c.from_mailbox_id
    from reclamados cl
    join public.campaign_emails e on e.id = cl.campaign_email_id
    join public.campaigns c on c.id = cl.campaign_id
    left join public.profiles p on p.id = cl.profile_id
    left join public.plans pl on pl.id = p.plan_id
    cross join lateral (
      select coalesce(
        nullif(p.full_name, ''),
        (select l.name from public.site_leads l where lower(l.email) = cl.email limit 1),
        ''
      ) as completo
    ) nome;
end;
$$;

comment on function public.campaign_claim_recipients(integer) is
  'P10-08: reclama destinatários pendentes (for update skip locked) e devolve os ingredientes do e-mail. Só a service_role — é o worker que entrega.';

revoke all on function public.campaign_claim_recipients(integer) from public, anon, authenticated;
grant execute on function public.campaign_claim_recipients(integer) to service_role;

-- ---------------------------------------------------------------------------
-- campaign_recipient_sent — e a passagem ao e-mail seguinte da sequência
--
-- O momento em que um e-mail da sequência acaba é o momento em que o seguinte
-- ganha data: `send_at = now() + delay`. Calculado **aqui** e guardado, e não
-- recalculado a cada leitura, pela razão que `20261015090000` já deu — mudar o
-- `delay` de um e-mail não pode mover silenciosamente os que já estão
-- agendados.
--
-- E quando não há seguinte, a campanha está enviada. É a única porta por onde
-- `status = 'sent'` acontece.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_recipient_sent(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_email uuid;
  v_position integer;
  v_next uuid;
  v_delay interval;
begin
  update public.campaign_recipients
     set status = 'sent', last_error = null
   where id = p_id
  returning campaign_id, campaign_email_id into v_campaign, v_email;

  if not found then return; end if;

  -- Ainda há gente neste e-mail da sequência? Então não há nada a decidir.
  if exists (
    select 1 from public.campaign_recipients
     where campaign_email_id = v_email and status in ('pending', 'sending')
  ) then
    return;
  end if;

  select position into v_position from public.campaign_emails where id = v_email;

  select id, delay into v_next, v_delay
    from public.campaign_emails
   where campaign_id = v_campaign and position > coalesce(v_position, 0)
   order by position
   limit 1;

  if v_next is not null then
    update public.campaign_emails
       set send_at = now() + coalesce(v_delay, interval '0')
     where id = v_next and send_at is null;
    return;
  end if;

  update public.campaigns
     set status = 'sent', sent_at = now()
   where id = v_campaign
     and status = 'sending'
     and not exists (
       select 1 from public.campaign_recipients r
        where r.campaign_id = v_campaign and r.status in ('pending', 'sending')
     );
end;
$$;

comment on function public.campaign_recipient_sent(uuid) is
  'P10-08: marca entregue, dá data ao e-mail seguinte da sequência e fecha a campanha quando não há seguinte.';

revoke all on function public.campaign_recipient_sent(uuid) from public, anon, authenticated;
grant execute on function public.campaign_recipient_sent(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- campaign_recipient_failed — falhar com motivo, e parar às cinco
--
-- Volta a `pending` para a passagem seguinte tentar, até às cinco tentativas;
-- daí em diante fica `failed` e conta como devolução nas métricas da campanha.
-- É a mesma política de `notification_deliveries` (`outbox.ts`), e o mesmo
-- número: cinco.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_recipient_failed(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_campaign uuid;
begin
  select attempts, campaign_id into v_attempts, v_campaign
    from public.campaign_recipients where id = p_id;
  if not found then return; end if;

  update public.campaign_recipients
     set status = case when v_attempts >= 5 then 'failed'::public.campaign_recipient_status
                       else 'pending'::public.campaign_recipient_status end,
         last_error = left(coalesce(p_error, ''), 500)
   where id = p_id;

  if v_attempts >= 5 then
    update public.campaigns set bounces = bounces + 1 where id = v_campaign;
  end if;
end;
$$;

comment on function public.campaign_recipient_failed(uuid, text) is
  'P10-08: devolve à fila com o motivo, e desiste às cinco tentativas — a mesma política de notification_deliveries.';

revoke all on function public.campaign_recipient_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.campaign_recipient_failed(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- campaign_advance_sequence — os e-mails cuja espera acabou
--
-- Materializa os que têm `send_at` no passado e ainda não foram expandidos, e
-- fecha as campanhas que já não têm nada por enviar. O fecho precisa de estar
-- aqui **e** em `campaign_recipient_sent` por uma razão concreta: uma audiência
-- onde todos cancelaram a subscrição expande-se para zero destinatários, e
-- nesse caso não há nenhum "último enviado" que dispare o fecho.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_advance_sequence()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email uuid;
  v_total integer := 0;
begin
  for v_email in
    select e.id
      from public.campaign_emails e
      join public.campaigns c on c.id = e.campaign_id
     where c.status = 'sending'
       and e.materialized_at is null
       and e.send_at is not null
       and e.send_at <= now()
     order by e.send_at
  loop
    v_total := v_total + public.campaign_materialize_recipients(v_email);
  end loop;

  update public.campaigns c
     set status = 'sent', sent_at = now()
   where c.status = 'sending'
     and not exists (
       select 1 from public.campaign_recipients r
        where r.campaign_id = c.id and r.status in ('pending', 'sending')
     )
     and not exists (
       select 1 from public.campaign_emails e
        where e.campaign_id = c.id and e.materialized_at is null
     );

  return v_total;
end;
$$;

comment on function public.campaign_advance_sequence() is
  'P10-08: expande os e-mails da sequência cuja espera acabou e fecha as campanhas sem nada por enviar.';

revoke all on function public.campaign_advance_sequence() from public, anon, authenticated;
grant execute on function public.campaign_advance_sequence() to service_role;

-- ---------------------------------------------------------------------------
-- campaign_unsubscribe — o link que 02 §4.3 exige, e a única função anónima
--
-- **O token é a identidade.** Quem clica no link não tem sessão — está na caixa
-- de entrada dele, meses depois, talvez noutro dispositivo — e exigir login
-- para cancelar uma subscrição é exigir uma conta para exercer um direito. O
-- token é por destinatário (`20261015090000`) exatamente para isto: um link
-- partilhado deixava qualquer pessoa cancelar a subscrição de outra.
--
-- Faz três coisas, e a terceira é a que não é óbvia:
--
-- 1. **A supressão**, que é o que trava o envio — para esta campanha e para
--    todas as outras.
-- 2. **A contagem**, uma vez só: o `on conflict do nothing` com `returning` é o
--    que impede que dois cliques no mesmo link contem dois cancelamentos.
-- 3. **Retira o consentimento** na conta ou na lead. A supressão já travava o
--    envio, mas deixar `marketing_consent = true` era guardar um consentimento
--    que a pessoa acabou de retirar — e é o consentimento, não a supressão, que
--    responde a um pedido de prestação de contas.
--
-- Devolve `true` mesmo num token já usado: a pessoa vê "subscrição cancelada",
-- que é a verdade. Um `false` por já estar cancelado era uma mensagem de erro
-- para quem fez tudo bem.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_email text;
  v_profile uuid;
  v_novo uuid;
begin
  select campaign_id, email, profile_id into v_campaign, v_email, v_profile
    from public.campaign_recipients where unsubscribe_token = p_token;

  if not found then return false; end if;

  insert into public.email_suppressions (email, reason, campaign_id)
  values (lower(v_email), 'unsubscribe', v_campaign)
  on conflict (email) do nothing
  returning id into v_novo;

  if v_novo is not null then
    update public.campaigns set unsubscribes = unsubscribes + 1 where id = v_campaign;
  end if;

  if v_profile is not null then
    update public.profiles
       set marketing_consent = false, marketing_consent_at = null
     where id = v_profile;
  else
    update public.site_leads
       set consent_marketing = false, consent_at = null
     where lower(email) = lower(v_email);
  end if;

  return true;
end;
$$;

comment on function public.campaign_unsubscribe(uuid) is
  'P10-08 · 02 §4.3: o link de cancelar subscrição. Anónima de propósito — o token é a identidade, e exigir login era exigir conta para exercer um direito.';

revoke all on function public.campaign_unsubscribe(uuid) from public;
grant execute on function public.campaign_unsubscribe(uuid) to anon, authenticated;
