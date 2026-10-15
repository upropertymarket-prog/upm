-- ---------------------------------------------------------------------------
-- A assinatura resolvida, para o worker (P10-08, 3.ª parte)
--
-- Um problema que só aparece ao ligar o envio: o bloco `signature` de uma
-- campanha precisa da assinatura **resolvida**, e quem renderiza o e-mail é o
-- `mail-worker` — que corre com a `service_role` e **sem utilizador nenhum**.
-- `is_internal()` lê `auth.uid()`, que é nulo nesse caso, logo
-- `resolve_signature_variables()` devolvia string vazia e a campanha saía sem
-- assinatura sem ninguém perceber porquê. É a terceira vez que este guarda
-- morde nesta tarefa, e desta vez por um motivo diferente dos outros dois.
--
-- ## Porque é que a solução é alargar o guarda e não duplicar a substituição
--
-- A tentação era uma função nova, sem guarda, com a mesma lista de `replace()`.
-- Seriam **duas** substituições a divergir na primeira variável nova — é o
-- argumento que 07 §24.5 deu para o SEO não ter dois editores e o que levou
-- esta função a nascer separada de `mailbox_signature()` em P10-06.
--
-- `auth.role()` é a forma de distinguir a `service_role` quando `auth.uid()` é
-- nulo: o PostgREST põe o papel do JWT em `request.jwt.claim.role`, e é isso
-- que ela lê. Numa ligação direta ao Postgres (psql, `pg_cron`) devolve nulo e
-- o guarda continua a fechar — o que é o comportamento certo: quem precisa
-- disto é o worker, que fala pelo PostgREST.
--
-- O que se abre é a leitura de uma assinatura de equipa já resolvida. A
-- credencial da caixa continua fechada em `mailbox_credential()`, que tem
-- `grant` só para a `service_role` e é a única porta para o Vault.
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
  if not (public.is_internal() or coalesce(auth.role(), '') = 'service_role') then
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
  'P10-06 · 05 §1.8. is_internal() OU service_role: o mail-worker renderiza campanhas sem utilizador, e uma segunda substituição divergiria desta (07 §24.5).';

-- ---------------------------------------------------------------------------
-- campaign_signature_html — a assinatura do bloco deste e-mail da sequência
--
-- O `mailboxId` do bloco `signature` vive dentro do `jsonb` dos blocos, e é por
-- isso que esta função existe em vez de o worker o ir lá buscar e chamar
-- `mailbox_signature()`: a forma dos blocos é o contrato de
-- `campaign-blocks.ts`, e lê-lo em TypeScript **e** em SQL dava dois sítios a
-- saber onde está o `mailboxId`.
--
-- Devolve `''` quando não há bloco de assinatura ou quando a caixa não tem
-- nenhuma — e o renderizador, nesse caso, omite o bloco em vez de deixar um
-- espaço em branco com uma linha por cima.
-- ---------------------------------------------------------------------------

create or replace function public.campaign_signature_html(p_campaign_email_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mailbox uuid;
begin
  select (b.value ->> 'mailboxId')::uuid into v_mailbox
    from public.campaign_emails e
    cross join lateral jsonb_array_elements(e.blocks) as b(value)
   where e.id = p_campaign_email_id
     and b.value ->> 'type' = 'signature'
     and nullif(b.value ->> 'mailboxId', '') is not null
   limit 1;

  if v_mailbox is null then return ''; end if;

  return public.mailbox_signature(v_mailbox);
end;
$$;

comment on function public.campaign_signature_html(uuid) is
  'P10-08: a assinatura resolvida do bloco signature deste e-mail. Lê o mailboxId do jsonb aqui para não haver dois sítios a conhecer a forma dos blocos.';

revoke all on function public.campaign_signature_html(uuid) from public, anon;
grant execute on function public.campaign_signature_html(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `mailbox_signature()` tem de aceitar a `service_role` pela mesma razão:
-- `campaign_signature_html()` chama-a, e um guarda fechado ali tornava a
-- função de cima inútil para quem mais precisa dela.
-- ---------------------------------------------------------------------------

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
  if not (public.is_internal() or coalesce(auth.role(), '') = 'service_role') then
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

comment on function public.mailbox_signature(uuid) is
  'P10-04 · 05 §1.8. is_internal() OU service_role — ver resolve_signature_variables.';
