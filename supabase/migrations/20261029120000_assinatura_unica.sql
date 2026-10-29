-- ---------------------------------------------------------------------------
-- Uma assinatura para toda a empresa (29 out 2026)
--
-- Até aqui, 05 §1.8 dizia "uma caixa tem uma assinatura; uma assinatura pode
-- servir várias caixas", e a tabela guardava a relação em `mailbox_ids uuid[]`.
-- O cliente decidiu que **toda a empresa usa a mesma assinatura**: deixa de
-- haver escolha de caixas, lista de assinaturas e "Nova assinatura".
--
-- ## O que muda, e o que fica igual
--
-- - `email_signatures` passa a ter **no máximo uma linha**. Um índice único
--   sobre uma expressão constante é a forma de o dizer no esquema, em vez de o
--   confiar à app: uma segunda linha é recusada pela base de dados.
-- - `mailbox_ids` sai. Sem escolha de caixas não há relação a guardar, e uma
--   coluna que ninguém escreve acabava a ser lida por alguém como se valesse.
-- - `mailbox_signature(caixa)` **mantém a assinatura e a semântica**: devolve a
--   assinatura da empresa resolvida com os dados do dono **daquela** caixa. A
--   assinatura é a mesma para todos, mas o `{{nome}}` continua a ser de quem
--   envia — é isso que o composer e as campanhas (`campaign_signature_html`)
--   precisam, e por isso nenhum dos dois muda.
-- - `email_signature_save` perde o `id`, o nome e as caixas: há uma linha, e
--   guardar é escrevê-la (criando-a da primeira vez).
-- - `email_signature_delete` sai. Para tirar a assinatura dos e-mails, grava-se
--   o HTML vazio — o composer já trata `''` como "sem assinatura".
--
-- ## As linhas que já existiam
--
-- Fica a **editada mais recentemente**, e as outras são apagadas. É a que o
-- Suporte mexeu por último, e por isso a que tem mais probabilidade de ser a
-- que querem. Antes de aplicar em produção, confirmar qual é (07 §20.7).
-- ---------------------------------------------------------------------------

delete from public.email_signatures
 where id is distinct from (
   select id from public.email_signatures
    order by updated_at desc, created_at desc
    limit 1
 );

alter table public.email_signatures drop column mailbox_ids;

-- O nome deixa de ser pedido no ecrã; a coluna fica, com um valor por omissão,
-- para a linha continuar a dizer o que é a quem a abrir no Studio.
alter table public.email_signatures
  alter column name set default 'Assinatura da empresa';

create unique index email_signatures_uma_so on public.email_signatures ((true));

comment on table public.email_signatures is
  'P10-06 · 05 §1.8, revisto a 29 out 2026: a assinatura da empresa — no máximo uma linha (email_signatures_uma_so). O composer e as campanhas leem-na por mailbox_signature().';

-- ---------------------------------------------------------------------------
-- mailbox_signature — a assinatura da empresa, resolvida para esta caixa
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

  select s.html into v_html from public.email_signatures s limit 1;

  if v_html is null or v_html = '' then
    return '';
  end if;

  return public.resolve_signature_variables(v_html, p_mailbox_id);
end;
$$;

comment on function public.mailbox_signature(uuid) is
  'P10-04 · 05 §1.8, revisto a 29 out 2026: a assinatura única da empresa, resolvida com os dados do dono desta caixa. is_internal() OU service_role — ver resolve_signature_variables.';

-- ---------------------------------------------------------------------------
-- email_signature_save — escrever a única linha
-- ---------------------------------------------------------------------------

drop function if exists public.email_signature_save(uuid, text, text, uuid[]);
drop function if exists public.email_signature_delete(uuid);

create function public.email_signature_save(p_html text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- O Suporte e não o Admin (07 §24.6 #3) — a mesma regra de antes.
  if not public.is_support() then
    raise exception 'Apenas o Suporte edita a assinatura.' using errcode = '42501';
  end if;

  -- A prova de que a sanitização correu — o guarda POSIX de 20261014110100,
  -- tal e qual. Não é a defesa: essa é `packages/db/src/signatures.ts`.
  if p_html ~* '<[[:space:]]*/?[[:space:]]*(script|iframe|style|form|object|embed)([^a-z]|$)'
     or p_html ~* '[[:space:]]on[a-z]+[[:space:]]*='
     or p_html ~* 'javascript[[:space:]]*:' then
    raise exception 'HTML inseguro: a assinatura tem de ser sanitizada antes de ser gravada.'
      using errcode = '22023';
  end if;

  update public.email_signatures
     set html = coalesce(p_html, '')
  returning id into v_id;

  if v_id is null then
    -- Duas primeiras gravações em simultâneo: o índice único recusa a segunda,
    -- e quem a fez volta a tentar e cai no `update` de cima.
    insert into public.email_signatures (html)
    values (coalesce(p_html, ''))
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.email_signature_save(text) is
  'P10-06, revisto a 29 out 2026: a única porta de escrita em email_signatures. Escreve a linha única (criando-a da primeira vez). HTML vazio = sem assinatura.';

revoke all on function public.email_signature_save(text) from public, anon;
grant execute on function public.email_signature_save(text) to authenticated;
