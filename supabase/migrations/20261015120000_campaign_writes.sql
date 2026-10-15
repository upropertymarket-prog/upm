-- ---------------------------------------------------------------------------
-- As escritas das campanhas (P10-08 · 04 §2.6 · 07 §24.6)
--
-- `20261015090000` criou as quatro tabelas **sem uma única policy de escrita**,
-- com a razão escrita no topo: "as linhas nascem e mudam por função
-- `security definer`, como em todo o correio desta fase". Este ficheiro são
-- essas funções. Até aqui o construtor visual não tinha como guardar nada.
--
-- ## Porque é que não é uma policy de `update`
--
-- A mesma razão de `email_signatures` e de `app_updates`, e aqui há três
-- invariantes a verificar que uma policy não sabe ver:
--
-- 1. **Uma campanha em envio ou enviada não se edita.** Os destinatários já
--    receberam o HTML que estava nos blocos nesse momento; reescrevê-los
--    deixava as métricas e os recibos de P10-09 a apontar para um conteúdo que
--    ninguém recebeu. É a mesma figura da atualização publicada.
-- 2. **O rodapé é obrigatório** (02 §4.3 — o link de cancelar subscrição). O
--    `campaignBlocksSchema` de `packages/db/src/campaign-blocks.ts` já o exige,
--    e aqui repete-se: se esta verificação disparar, há um caminho de escrita
--    que não passou pela server action.
-- 3. **Uma campanha é uma sequência de 1..N.** Apagar o último e-mail deixava
--    uma campanha sem conteúdo nenhum, que é um estado que não devia existir.
--
-- ## O que estas funções NÃO fazem
--
-- Não enviam, não materializam `campaign_recipients` e não falam com o
-- `mail-worker`. `campaign_schedule()` põe o estado e a data — quem os lê e
-- executa é **P10-09** (`scheduled_sends` + `pg_cron`), e o índice
-- `campaigns_due_idx` já existe à espera disso. Agendar hoje não dispara nada,
-- e é por isso que agendar hoje é seguro.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Primeiro: as duas funções da assinatura passam a servir o Marketing
--
-- `resolve_signature_variables()` tem no seu próprio comentário, escrito em
-- P10-06, que "serve o composer, o editor e, **amanhã, as campanhas**". Amanhã
-- é hoje — e as duas estão guardadas a `is_staff()`, que por decisão de 07
-- §24.6 **não inclui o marketing**. Sem esta passagem, o bloco `signature` do
-- construtor devolvia string vazia e a pré-visualização mostrava um e-mail sem
-- assinatura sem dizer porquê.
--
-- Passam a `is_internal()` (admin | support | marketing), que é exactamente o
-- predicado que 07 §24.6 criou para "qualquer pessoa da equipa interna" — e
-- não um `is_staff()` alargado, que é o que esse mesmo parágrafo proíbe. O que
-- se abre é a leitura de uma assinatura resolvida; a credencial da caixa
-- continua a precisar de `mailbox_credential()`, que só a `service_role` tem.
--
-- Uma migração aplicada não se reescreve (07 §20.7): o corpo das duas vem daqui
-- em `create or replace`, igual ao de `20261014110000` menos o guarda.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_signature_variables(
  p_html text,
  p_mailbox_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_html text := coalesce(p_html, '');
  v_name text := '';
  v_title text := '';
  v_department text := '';
  v_phone text := '';
  v_email text := '';
begin
  if not public.is_internal() then
    return '';
  end if;

  select coalesce(p.full_name, ''), coalesce(sm.title, ''),
         coalesce(sm.department::text, ''), coalesce(sm.phone, ''), coalesce(m.address, '')
    into v_name, v_title, v_department, v_phone, v_email
    from public.mailboxes m
    left join public.profiles p on p.id = m.owner_profile_id
    left join public.staff_members sm on sm.profile_id = m.owner_profile_id
   where m.id = p_mailbox_id;

  v_html := replace(v_html, '{{nome}}', v_name);
  v_html := replace(v_html, '{{cargo}}', v_title);
  v_html := replace(v_html, '{{departamento}}', v_department);
  v_html := replace(v_html, '{{telefone}}', v_phone);
  v_html := replace(v_html, '{{email}}', v_email);
  v_html := replace(
    v_html, '{{iniciais}}',
    upper(left(coalesce(nullif(v_name, ''), v_email), 1))
  );

  return v_html;
end;
$$;

comment on function public.resolve_signature_variables(text, uuid) is
  'P10-06 · 05 §1.8, alargada em P10-08: resolve as seis variáveis da assinatura. is_internal() porque o bloco signature das campanhas é do Marketing (07 §24.6).';

create or replace function public.mailbox_signature(p_mailbox_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_html text;
begin
  if not public.is_internal() then
    return '';
  end if;

  -- Uma caixa tem uma assinatura (05 §1.8), e `email_signature_save()` impõe-o;
  -- o `order by` é o que resolvia a ambiguidade antes desse invariante existir
  -- e fica como rede.
  select s.html into v_html
    from public.email_signatures s
   where p_mailbox_id = any (s.mailbox_ids)
   order by s.created_at
   limit 1;

  if v_html is null or v_html = '' then
    return '';
  end if;

  return public.resolve_signature_variables(v_html, p_mailbox_id);
end;
$$;

comment on function public.mailbox_signature(uuid) is
  'P10-04 · 05 §1.8, alargada em P10-08: a assinatura desta caixa, resolvida. is_internal() — ver resolve_signature_variables.';

-- ---------------------------------------------------------------------------
-- campaign_sender_options — a lista de remetentes, e só o que é de remetente
--
-- O construtor precisa de escolher em nome de quem a campanha sai (07 §24.6 #2:
-- "a caixa é a identidade do remetente, não o transporte"). O caminho óbvio
-- era abrir `mailboxes` ao Marketing com uma policy nova — e é o caminho
-- errado: uma policy é por **linha** e não por coluna, e dava-lhe de uma vez os
-- anfitriões, as portas, os nomes de utilizador e o `secret_id` de todas as
-- caixas do Suporte. Nada disso é escolher um remetente.
--
-- Uma função que devolve três colunas é o mesmo princípio de
-- `campaign_audience_count()`: o Marketing recebe o que precisa e não o resto.
-- Só caixas activas — uma caixa parada como remetente é uma campanha que falha
-- no envio sem ninguém entender porquê.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_sender_options()
returns table (id uuid, address text, display_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing escolhe remetentes de campanha.' using errcode = '42501';
  end if;

  return query
    select m.id, m.address, m.display_name
      from public.mailboxes m
     where m.status = 'active'
     order by m.display_name, m.address;
end;
$$;

comment on function public.campaign_sender_options() is
  'P10-08 · 07 §24.6 #2: as caixas activas como identidade de remetente — id, endereço e nome, e mais nada. Não se abre `mailboxes` ao Marketing por policy: dava-lhe a configuração toda.';

revoke all on function public.campaign_sender_options() from public, anon;
grant execute on function public.campaign_sender_options() to authenticated;

-- ---------------------------------------------------------------------------
-- O guarda de HTML inseguro, partilhado pelas duas funções que gravam blocos
--
-- Como em `app_update_save()`: **não é a defesa**. A sanitização é a do
-- servidor Node (`sanitize-html`, 02 §4.3, em `packages/db/src/campaigns.ts`),
-- que é onde está a lista do que passa. Isto é a prova de que ela correu — se
-- disparar, há um caminho de escrita que não passou pela server action.
--
-- As classes são POSIX (`[[:space:]]`) e não `\s`: o ARE do Postgres não
-- entende os atalhos do JavaScript, e foi assim que `20261014110100` nasceu —
-- uma versão com `\s` que não apanhava nada.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_blocks_are_safe(p_blocks jsonb)
returns boolean
language sql
immutable
as $$
  select not (
    p_blocks::text ~* '<[[:space:]]*/?[[:space:]]*(script|iframe|style|form|object|embed)([^a-z]|$)'
    or p_blocks::text ~* '[[:space:]]on[a-z]+[[:space:]]*='
    or p_blocks::text ~* 'javascript[[:space:]]*:'
  );
$$;

comment on function public.campaign_blocks_are_safe(jsonb) is
  'P10-08: recusa o que nunca devia ter chegado à base de dados. A sanitização é a do Node (02 §4.3); esta é a prova de que correu.';

-- ---------------------------------------------------------------------------
-- campaign_save — criar e editar a campanha (o que não é conteúdo)
--
-- Ao criar, nasce **com o primeiro e-mail da sequência**, na mesma transacção.
-- Uma campanha sem nenhum e-mail é um estado que o construtor teria de saber
-- desenhar e que não quer dizer nada: "uma campanha é uma sequência de 1..N"
-- (05 §1.9), e N começa em 1.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_save(
  p_id uuid,
  p_name text,
  p_audience public.campaign_audience,
  p_from_mailbox_id uuid,
  p_email_bg text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.campaign_status;
begin
  -- Nos dois lados (07 §20.5), e **`marketing` e não `is_staff()`**: 07 §24.6
  -- é explícito em que o alargamento de `is_staff()` não acontece.
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing edita campanhas.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'A campanha precisa de um nome.' using errcode = '22023';
  end if;

  if coalesce(p_email_bg, '') !~* '^#[0-9a-f]{6}$' then
    raise exception 'O fundo do e-mail tem de ser hexadecimal.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.campaigns (name, audience, from_mailbox_id, email_bg, created_by)
    values (
      btrim(p_name), coalesce(p_audience, 'all'), p_from_mailbox_id,
      p_email_bg, auth.uid()
    )
    returning id into v_id;

    -- O primeiro e-mail da sequência, vazio: os blocos por omissão são do
    -- construtor, que é quem conhece o contrato de `campaign-blocks.ts`.
    insert into public.campaign_emails (campaign_id, position)
    values (v_id, 1);

    return v_id;
  end if;

  select status into v_status from public.campaigns where id = p_id;
  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;

  if v_status in ('sending', 'sent') then
    raise exception 'Uma campanha enviada não se edita — duplique-a e escreva outra.'
      using errcode = '42501';
  end if;

  update public.campaigns
     set name = btrim(p_name),
         audience = coalesce(p_audience, 'all'),
         from_mailbox_id = p_from_mailbox_id,
         email_bg = p_email_bg
   where id = p_id;

  return p_id;
end;
$$;

comment on function public.campaign_save(uuid, text, public.campaign_audience, uuid, text) is
  'P10-08: cria/edita a campanha. Ao criar nasce com o e-mail 1 da sequência (05 §1.9). Recusa editar uma em envio ou enviada.';

-- ---------------------------------------------------------------------------
-- campaign_email_save — o conteúdo, que é onde vivem os blocos
--
-- `p_delay_days` é um inteiro e não um `interval`, e isso é deliberado: o doc
-- dá o exemplo `+3 days`, a coluna é um `interval` que o aceita tal e qual, mas
-- um `interval` não atravessa o `supabase-js` sem uma representação textual que
-- ninguém valida. O que o ecrã oferece são dias; `make_interval` fecha a
-- conversão **num sítio só**.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_email_save(
  p_id uuid,
  p_campaign_id uuid,
  p_name text,
  p_subject text,
  p_preheader text,
  p_blocks jsonb,
  p_delay_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.campaign_status;
  v_position integer;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing edita campanhas.' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' then
    raise exception 'Os blocos têm de ser uma lista.' using errcode = '22023';
  end if;

  if not public.campaign_blocks_are_safe(coalesce(p_blocks, '[]'::jsonb)) then
    raise exception 'HTML inseguro: os blocos têm de ser sanitizados antes de serem gravados.'
      using errcode = '22023';
  end if;

  -- **O rodapé** (02 §4.3 — o link de cancelar subscrição em todas as
  -- campanhas). Exigido com a lista já escrita e não numa lista vazia: um
  -- e-mail acabado de criar ainda não tem blocos, e o construtor é que lhe põe
  -- os primeiros. A partir daí, não há forma de ficar sem ele.
  if jsonb_array_length(coalesce(p_blocks, '[]'::jsonb)) > 0
     and not exists (
       select 1 from jsonb_array_elements(p_blocks) b
        where b->>'type' = 'footer'
     ) then
    raise exception 'Falta o rodapé com o link de cancelar subscrição (RGPD, 02 §4.3).'
      using errcode = '22023';
  end if;

  if p_id is null then
    select status into v_status from public.campaigns where id = p_campaign_id;
    if not found then
      raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
    end if;
    if v_status in ('sending', 'sent') then
      raise exception 'Uma campanha enviada não se edita — duplique-a e escreva outra.'
        using errcode = '42501';
    end if;

    select coalesce(max(position), 0) + 1 into v_position
      from public.campaign_emails where campaign_id = p_campaign_id;

    insert into public.campaign_emails (
      campaign_id, position, name, subject, preheader, blocks, delay
    ) values (
      p_campaign_id, v_position, coalesce(p_name, ''), coalesce(p_subject, ''),
      coalesce(p_preheader, ''), coalesce(p_blocks, '[]'::jsonb),
      make_interval(days => greatest(coalesce(p_delay_days, 0), 0))
    )
    returning id into v_id;

    return v_id;
  end if;

  select c.status into v_status
    from public.campaign_emails e
    join public.campaigns c on c.id = e.campaign_id
   where e.id = p_id;

  if not found then
    raise exception 'Este e-mail já não existe.' using errcode = 'P0002';
  end if;
  if v_status in ('sending', 'sent') then
    raise exception 'Uma campanha enviada não se edita — duplique-a e escreva outra.'
      using errcode = '42501';
  end if;

  update public.campaign_emails
     set name = coalesce(p_name, ''),
         subject = coalesce(p_subject, ''),
         preheader = coalesce(p_preheader, ''),
         blocks = coalesce(p_blocks, '[]'::jsonb),
         delay = make_interval(days => greatest(coalesce(p_delay_days, 0), 0))
   where id = p_id;

  return p_id;
end;
$$;

comment on function public.campaign_email_save(uuid, uuid, text, text, text, jsonb, integer) is
  'P10-08: grava um e-mail da sequência. Exige o rodapé (02 §4.3) e recusa HTML inseguro — a prova de que a sanitização do Node correu.';

-- ---------------------------------------------------------------------------
-- campaign_email_delete — e a renumeração, que é a parte que importa
--
-- As posições são 1..N com índice único por campanha. Apagar o e-mail 2 de três
-- deixava 1 e 3, e o próximo "adicionar" calculava `max + 1 = 4`: uma sequência
-- com um buraco, que o `delay` de P10-09 leria como uma espera que ninguém
-- escreveu. Renumera-se aqui, na mesma transacção.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_email_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_status public.campaign_status;
  v_count integer;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing edita campanhas.' using errcode = '42501';
  end if;

  select e.campaign_id, c.status into v_campaign, v_status
    from public.campaign_emails e
    join public.campaigns c on c.id = e.campaign_id
   where e.id = p_id;

  if not found then
    raise exception 'Este e-mail já não existe.' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Só se apaga um e-mail de uma campanha em rascunho.' using errcode = '42501';
  end if;

  select count(*) into v_count from public.campaign_emails where campaign_id = v_campaign;
  if v_count <= 1 then
    raise exception 'Uma campanha é uma sequência de pelo menos um e-mail.'
      using errcode = '42501';
  end if;

  delete from public.campaign_emails where id = p_id;

  -- A renumeração: 1..N outra vez, pela ordem que ficou.
  with ordered as (
    select id, row_number() over (order by position) as novo
      from public.campaign_emails
     where campaign_id = v_campaign
  )
  update public.campaign_emails e
     set position = ordered.novo
    from ordered
   where e.id = ordered.id and e.position <> ordered.novo;
end;
$$;

comment on function public.campaign_email_delete(uuid) is
  'P10-08: apaga um e-mail da sequência e renumera as posições. Recusa o último — 1..N começa em 1.';

-- ---------------------------------------------------------------------------
-- campaign_schedule / campaign_unschedule
--
-- Põem o estado e a data, e mais nada. **Quem dispara é P10-09**
-- (`scheduled_sends` + `pg_cron` + `mail-worker`), e o índice
-- `campaigns_due_idx` existe desde `20261015090000` à espera disso. Separar o
-- agendamento do disparo é o que permite agendar hoje sem que nada saia: o
-- estado é verdade, o envio é que ainda não tem quem o execute.
--
-- Agendar exige o assunto e os blocos escritos em **todos** os e-mails da
-- sequência: uma campanha agendada com um e-mail vazio é um envio em branco com
-- data marcada, e o momento de o dizer é agora e não quando o cron a apanhar.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_schedule(p_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
  v_incompletos integer;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing agenda campanhas.' using errcode = '42501';
  end if;

  if p_at is null then
    raise exception 'Uma campanha agendada tem de ter data.' using errcode = '22023';
  end if;
  if p_at <= now() then
    raise exception 'A data de agendamento tem de ser no futuro.' using errcode = '22023';
  end if;

  select status into v_status from public.campaigns where id = p_id;
  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status in ('sending', 'sent') then
    raise exception 'Esta campanha já saiu.' using errcode = '42501';
  end if;

  select count(*) into v_incompletos
    from public.campaign_emails
   where campaign_id = p_id
     and (
       length(btrim(subject)) = 0
       or jsonb_array_length(blocks) = 0
     );

  if v_incompletos > 0 then
    raise exception 'Há e-mails na sequência sem assunto ou sem blocos.' using errcode = '22023';
  end if;

  update public.campaigns
     set status = 'scheduled', scheduled_at = p_at
   where id = p_id;
end;
$$;

comment on function public.campaign_schedule(uuid, timestamptz) is
  'P10-08: põe estado e data. O disparo é P10-09 (scheduled_sends + pg_cron) — agendar hoje não envia nada.';

create or replace function public.campaign_unschedule(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing agenda campanhas.' using errcode = '42501';
  end if;

  select status into v_status from public.campaigns where id = p_id;
  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status <> 'scheduled' then
    raise exception 'Esta campanha não está agendada.' using errcode = '42501';
  end if;

  update public.campaigns
     set status = 'draft', scheduled_at = null
   where id = p_id;
end;
$$;

comment on function public.campaign_unschedule(uuid) is
  'P10-08: devolve uma campanha agendada ao rascunho. O check campaigns_scheduled_has_date obriga a limpar a data com o estado.';

-- ---------------------------------------------------------------------------
-- campaign_delete — só um rascunho
--
-- Uma enviada não se apaga: `campaign_recipients` e as métricas de P10-09
-- desapareciam com ela pelo `on delete cascade`, e com elas a prova de que
-- aquele e-mail saiu para aquelas pessoas — que é precisamente o que um pedido
-- de prestação de contas pede. É a mesma decisão de `app_update_delete()`.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
begin
  if not public.is_marketing() then
    raise exception 'Apenas o Marketing apaga campanhas.' using errcode = '42501';
  end if;

  select status into v_status from public.campaigns where id = p_id;
  if not found then
    raise exception 'Esta campanha já não existe.' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Só se apaga uma campanha em rascunho.' using errcode = '42501';
  end if;

  delete from public.campaigns where id = p_id;
end;
$$;

comment on function public.campaign_delete(uuid) is
  'P10-08: apaga uma campanha em rascunho. Uma enviada fica — com ela ia a prova de que saiu.';

-- ---------------------------------------------------------------------------
-- Grants: `authenticated`, e o guarda é dentro de cada função
--
-- Como em todo o correio desta fase. `anon` e `public` perdem tudo: um clique
-- anónimo não edita campanhas, e o que um clique anónimo **vai** precisar
-- (cancelar subscrição por token) é uma função própria de P10-09, com o token
-- como única chave.
-- ---------------------------------------------------------------------------

revoke all on function public.campaign_save(uuid, text, public.campaign_audience, uuid, text)
  from public, anon;
revoke all on function public.campaign_email_save(uuid, uuid, text, text, text, jsonb, integer)
  from public, anon;
revoke all on function public.campaign_email_delete(uuid) from public, anon;
revoke all on function public.campaign_schedule(uuid, timestamptz) from public, anon;
revoke all on function public.campaign_unschedule(uuid) from public, anon;
revoke all on function public.campaign_delete(uuid) from public, anon;

grant execute on function public.campaign_save(uuid, text, public.campaign_audience, uuid, text)
  to authenticated;
grant execute on function public.campaign_email_save(uuid, uuid, text, text, text, jsonb, integer)
  to authenticated;
grant execute on function public.campaign_email_delete(uuid) to authenticated;
grant execute on function public.campaign_schedule(uuid, timestamptz) to authenticated;
grant execute on function public.campaign_unschedule(uuid) to authenticated;
grant execute on function public.campaign_delete(uuid) to authenticated;
