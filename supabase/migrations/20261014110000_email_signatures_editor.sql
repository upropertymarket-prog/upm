-- ---------------------------------------------------------------------------
-- O editor de assinaturas (P10-06 · 04 §2.6 · 05 §1.8)
--
-- A tabela `email_signatures` nasceu em `20261014090000`, com o composer, e com
-- **leitura só**: a `service_role` escrevia, ninguém mais, porque não havia
-- ecrã que escrevesse. Esta migração abre as duas portas que o editor precisa —
-- e continua a não haver policy de `insert`/`update`/`delete`, pela mesma razão
-- de `mail_messages`: uma policy de `update` não distingue colunas nem verifica
-- invariantes, e aqui há dois a verificar.
--
-- ## Os dois invariantes, e porque é que não cabem numa policy
--
-- 1. **Uma caixa tem uma assinatura.** 05 §1.8 diz exatamente isto, e
--    `mailbox_signature()` depende disso: ela escolhe a primeira assinatura que
--    reclama a caixa, por `created_at`. Com duas a reclamá-la, o composer
--    inseria uma delas sem ninguém poder dizer qual — e a resposta mudava no dia
--    em que a mais antiga fosse apagada. Um índice único não serve: a relação
--    vive num `uuid[]`, e o que tem de ser único é cada **elemento** do array
--    entre linhas diferentes.
-- 2. **O HTML já vem sanitizado.** A sanitização é do servidor Node
--    (`sanitize-html`, 02 §4.3, em `packages/db/src/signatures.ts`): é lá que
--    está a lista do que passa, e um sanitizador em PL/pgSQL seria um segundo
--    sanitizador a divergir do primeiro. O que esta função faz é **recusar o
--    que nunca devia ter chegado aqui** — `<script`, `<iframe`, `on...=`,
--    `javascript:`. Não é a defesa; é a prova de que a defesa correu. Se esta
--    verificação disparar, há um caminho de escrita que não passou pela action,
--    e é isso que ela existe para tornar visível.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- resolve_signature_variables — a substituição, num sítio só
--
-- Estava dentro de `mailbox_signature()`. Sai para função própria porque o
-- editor precisa de pré-visualizar HTML que **ainda não está guardado** (04
-- §2.6: "pré-visualização por utilizador"), e a alternativa era um segundo
-- `replace()` na app ou no ecrã. Duas substituições divergem na primeira
-- variável nova — é a mesma razão que 07 §24.5 deu para o SEO não ter dois
-- editores.
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
  if not public.is_staff() then
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
  'P10-06 · 05 §1.8: resolve as seis variáveis da assinatura com os dados do dono da caixa. Serve o composer, o editor e, amanhã, as campanhas.';

revoke all on function public.resolve_signature_variables(text, uuid) from public, anon;
grant execute on function public.resolve_signature_variables(text, uuid) to authenticated, service_role;

-- `mailbox_signature()` passa a ser o que sempre foi, sem a cópia: "a
-- assinatura desta caixa, resolvida". A assinatura a escolher deixou de ser
-- ambígua por causa do invariante que `email_signature_save()` impõe.
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
  if not public.is_staff() then
    return '';
  end if;

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

-- ---------------------------------------------------------------------------
-- email_signature_save — criar e editar pela mesma porta
--
-- Uma porta e não duas: o editor é o mesmo ecrã nos dois casos, e `p_id` nulo é
-- a única diferença. Devolve o `id` para o ecrã continuar a editar a linha que
-- acabou de nascer em vez de criar uma segunda ao gravar outra vez.
-- ---------------------------------------------------------------------------

create or replace function public.email_signature_save(
  p_id uuid,
  p_name text,
  p_html text,
  p_mailbox_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ids uuid[] := coalesce(p_mailbox_ids, '{}');
  v_taken text;
begin
  -- Nos dois lados (07 §20.5): a action já verificou, e esta função tem de se
  -- defender de quem chame o RPC diretamente. **O Suporte e não o Admin:** a
  -- assinatura é de quem responde ao cliente, e 07 §24.6 #3 diz que ela vive no
  -- Suporte — o marketing lê-a nas campanhas e não a edita.
  if not public.is_support() then
    raise exception 'Apenas o Suporte edita assinaturas.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'A assinatura precisa de um nome.' using errcode = '22023';
  end if;

  -- A prova de que a sanitização correu (ver a nota de topo). Não é a defesa.
  if p_html ~* '<\s*(script|iframe|object|embed|style|form)\M'
     or p_html ~* '\son[a-z]+\s*='
     or p_html ~* 'javascript\s*:' then
    raise exception 'HTML inseguro: a assinatura tem de ser sanitizada antes de ser gravada.'
      using errcode = '22023';
  end if;

  -- Caixas que existem, e só isso: um uuid inventado deixaria uma assinatura
  -- associada a nada, invisível no ecrã e eternamente a reclamar a caixa.
  if exists (
    select 1 from unnest(v_ids) as id
     where not exists (select 1 from public.mailboxes m where m.id = id)
  ) then
    raise exception 'Caixa de e-mail inexistente.' using errcode = 'P0002';
  end if;

  -- O invariante de 05 §1.8: uma caixa, uma assinatura.
  select string_agg(m.address, ', ') into v_taken
    from public.email_signatures s
    join public.mailboxes m on m.id = any (s.mailbox_ids)
   where s.id is distinct from p_id
     and m.id = any (v_ids);

  if v_taken is not null then
    raise exception 'Estas caixas já têm assinatura: %', v_taken using errcode = '23505';
  end if;

  if p_id is null then
    insert into public.email_signatures (name, html, mailbox_ids)
    values (btrim(p_name), coalesce(p_html, ''), v_ids)
    returning id into v_id;
    return v_id;
  end if;

  update public.email_signatures
     set name = btrim(p_name),
         html = coalesce(p_html, ''),
         mailbox_ids = v_ids
   where id = p_id
  returning id into v_id;

  if v_id is null then
    raise exception 'Esta assinatura já não existe.' using errcode = 'P0002';
  end if;

  return v_id;
end;
$$;

revoke all on function public.email_signature_save(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.email_signature_save(uuid, text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- email_signature_delete
--
-- Apagar uma assinatura deixa as caixas dela **sem** assinatura, e o composer
-- passa a abrir sem nada em vez de abrir com a assinatura de outra pessoa. É o
-- comportamento certo: uma assinatura errada num e-mail de suporte é pior do
-- que nenhuma.
-- ---------------------------------------------------------------------------

create or replace function public.email_signature_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_support() then
    raise exception 'Apenas o Suporte apaga assinaturas.' using errcode = '42501';
  end if;

  delete from public.email_signatures where id = p_id;
end;
$$;

revoke all on function public.email_signature_delete(uuid) from public, anon;
grant execute on function public.email_signature_delete(uuid) to authenticated;
