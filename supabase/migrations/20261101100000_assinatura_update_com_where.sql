-- ---------------------------------------------------------------------------
-- email_signature_save — o `update` ganha um `where` (corrige 20261029120000)
-- ---------------------------------------------------------------------------
-- A versão de 29 out escrevia a linha única com
--
--     update public.email_signatures set html = ... returning id
--
-- sem `where`, porque a tabela tem no máximo uma linha. Na lógica está certo.
-- Mas no Supabase, os pedidos que chegam pela API correm com `pg_safeupdate`,
-- que recusa qualquer `update`/`delete` sem `where`, mesmo dentro de uma
-- função `security definer`. O resultado foi "UPDATE requires a WHERE clause"
-- na **segunda** gravação: a primeira cai no `insert`, que passa; regravar a
-- assinatura falhava sempre. Foi o `signatures-rls.test.ts` que o mostrou, a
-- 1 nov, ao correr contra a base real — o job `schema` do CI não o apanha,
-- porque aplica migrações e não faz pedidos pela API.
--
-- O `where id is not null` não filtra nada (`id` é a chave primária), e é
-- isso que se quer: diz ao `safeupdate` que a falta de filtro é deliberada.
--
-- Aproveita-se para fixar `search_path = ''`, a convenção para funções
-- `definer` novas desde 28 out; tudo o que o corpo usa já vem qualificado.
-- ---------------------------------------------------------------------------

create or replace function public.email_signature_save(p_html text)
returns uuid
language plpgsql
security definer
set search_path = ''
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

  -- Linha única: o `where` não filtra, mas tem de existir (ver cabeçalho).
  update public.email_signatures
     set html = coalesce(p_html, '')
   where id is not null
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

revoke all on function public.email_signature_save(text) from public, anon;
grant execute on function public.email_signature_save(text) to authenticated;
