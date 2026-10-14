-- ---------------------------------------------------------------------------
-- O guarda de HTML inseguro de `email_signature_save()` não guardava nada
--
-- `20261014110000` escreveu-o com `\s` e `\M`, à maneira das expressões
-- regulares de JavaScript ou PCRE. **No ARE do Postgres, nenhum dos dois faz o
-- que parece aqui**, e foi medido contra o Postgres de staging:
--
--   select ' x' ~ '\s'                           → false
--   select '<script>' ~* '<\s*(script|iframe)\M' → false
--   select ' onerror="x"' ~* '\son[a-z]+\s*='    → false
--
-- Ou seja: as três condições do guarda eram **sempre falsas** e a função
-- aceitava qualquer coisa. Não era uma falha de segurança — a sanitização a
-- sério é a de `packages/db/src/signatures.ts` (02 §4.3), que corre na action
-- antes da gravação e cujos testes passam —, mas era pior do que não ter
-- guarda: ficava escrito no esquema que existia uma verificação, e ninguém
-- voltaria a olhar para ela. Um guarda que nunca dispara é um guarda que
-- mente.
--
-- Esta migração reescreve-o com classes POSIX (`[[:space:]]`), que o Postgres
-- reconhece, e com `([^a-z]|$)` no lugar de `\M`. A formulação foi verificada
-- contra 21 casos em staging antes de ser escrita: as oito etiquetas e os três
-- vetores que tem de recusar, e dez marcações legítimas que **não** pode
-- recusar — entre elas `style="…"` como atributo (que é o que desenha uma
-- assinatura), a palavra "Scripting" dentro de texto, `one on one`, e o
-- desenho de 04 §2.6 por inteiro.
--
-- A migração anterior não se toca: já está aplicada, e 07 §20.7 é claro — se
-- faltar algo, é uma migração nova.
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

  -- A prova de que a sanitização correu, agora em POSIX. Três condições:
  --   1. a etiqueta de abertura (ou fecho) de um dos seis elementos que nunca
  --      pertencem a uma assinatura. `([^a-z]|$)` impede que "Scripting" num
  --      texto seja lido como `<script`;
  --   2. qualquer atributo `on…=`, que é o vetor mais comum de HTML colado. O
  --      `[[:space:]]` à cabeça é o que distingue ` onclick=` de uma palavra
  --      qualquer acabada em "on";
  --   3. `javascript:`, com ou sem espaço antes dos dois pontos.
  if p_html ~* '<[[:space:]]*/?[[:space:]]*(script|iframe|style|form|object|embed)([^a-z]|$)'
     or p_html ~* '[[:space:]]on[a-z]+[[:space:]]*='
     or p_html ~* 'javascript[[:space:]]*:' then
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

comment on function public.email_signature_save(uuid, text, text, uuid[]) is
  'P10-06: a única porta de escrita em email_signatures. O guarda de HTML inseguro usa classes POSIX — \s e \M não funcionam no ARE do Postgres (ver 20261014110100).';
