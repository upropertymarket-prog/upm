-- ---------------------------------------------------------------------------
-- A segunda porta do SEO abre-se de facto (07 §24.5 e §24.6 · P10-07)
-- ===========================================================================
-- `/marketing/seo` está no `MARKETING_NAV` desde P10-07 e **dá 404**: é a
-- única entrada de menu sem página. A nota do próprio menu diz o que tinha de
-- acontecer — *"o SEO tem aqui a sua segunda porta, não uma segunda cópia"*,
-- a apontar ao mesmo `SeoManager` e às mesmas server actions.
--
-- Só que a porta não dava para abrir. Construir o ecrã não bastava, porque o
-- que está do lado de dentro recusa o marketing em **três** sítios diferentes,
-- e nenhum deles se vê a partir do React:
--
--   1. `admin_save_seo_page` exige `is_admin()`. O botão de guardar devolvia
--      "Sem autorização" a quem o ecrã foi feito para servir.
--   2. `write_audit_log` exige `is_staff()` — e `is_staff()` **não** inclui o
--      marketing, de propósito (07 §24.6). Cada gravação acabaria com o aviso
--      "guardado, mas o registo de auditoria falhou", que é verdade e é
--      inaceitável como rotina.
--   3. `audit_log` só deixa o admin ler. O painel lê o registo para dizer quem
--      devolveu uma página ao ficheiro — a única alteração que **não** deixa
--      linha em `seo_pages`. Sem leitura, essa coluna vinha vazia para o
--      marketing: não um erro, uma meia-verdade, que é pior.
--
-- Depende de `20261021090000_seo_pages_locale.sql`, que trouxe a chave
-- `(route, locale)`. As duas estão por aplicar, e por esta ordem.
--
-- ## Porque é uma migração nova e não uma correção à 090000
--
-- Porque a 090000 pode já ter sido aplicada em alguma base — a minha, a de
-- staging — e o `supabase` identifica uma migração pelo prefixo, não pelo
-- conteúdo: editá-la no sítio não a faz voltar a correr onde já passou. Ficava
-- a diferença entre duas bases com o mesmo número e ninguém a ver. Uma
-- migração nova corre em qualquer dos dois estados.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Guardar SEO: admin **ou** marketing
--
-- Recriada por inteiro a partir da 090000, com uma linha diferente — a do
-- papel. O resto é igual de propósito: um `create or replace` parcial não
-- existe, e reescrever o corpo "de memória" era a forma de perder a recusa do
-- idioma inválido ou o `delete` que devolve a rota ao ficheiro.
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_seo_page(
  p_route text,
  p_locale text,
  p_title_tag text default null,
  p_meta_description text default null,
  p_og_same_as_page boolean default null,
  p_og_title text default null,
  p_og_description text default null,
  p_og_image text default null,
  p_og_image_alt text default null,
  p_canonical text default null,
  p_noindex boolean default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_title text := nullif(btrim(coalesce(p_title_tag, '')), '');
  v_description text := nullif(btrim(coalesce(p_meta_description, '')), '');
  v_og_title text := nullif(btrim(coalesce(p_og_title, '')), '');
  v_og_description text := nullif(btrim(coalesce(p_og_description, '')), '');
  v_og_image text := nullif(btrim(coalesce(p_og_image, '')), '');
  v_og_image_alt text := nullif(btrim(coalesce(p_og_image_alt, '')), '');
  v_canonical text := nullif(btrim(coalesce(p_canonical, '')), '');
  v_route text := btrim(coalesce(p_route, ''));
  v_locale text := btrim(coalesce(p_locale, ''));
begin
  -- A função é `security definer` e por isso passa por cima da RLS: o papel
  -- tem de ser verificado aqui, à cabeça, senão isto seria a porta das
  -- traseiras da tabela que acabámos de proteger.
  --
  -- **O marketing entra desde 21 out 2026.** Não é um alargamento de
  -- permissões por conveniência: é quem 07 §24.5 diz que faz este trabalho —
  -- *"é o marketing quem corrige um título em produção"*. Continua a ser uma
  -- lista de dois papéis e não um `is_internal()`: o suporte não edita SEO, e
  -- dar-lhe a tabela só porque é interno era alargar sem ninguém pedir.
  if not (public.is_admin() or public.is_marketing()) then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;

  if v_route <> '*' and v_route !~ '^/[^[:space:]]*$' then
    raise exception 'invalid_route' using hint = 'invalid_route';
  end if;

  -- Recusado em vez de cair em português. Um idioma inválido que caísse no
  -- valor por omissão escrevia texto inglês na linha portuguesa — a mesma
  -- confusão de línguas que a 090000 existe para acabar.
  if v_locale not in ('pt', 'en') then
    raise exception 'invalid_locale' using hint = 'invalid_locale';
  end if;

  -- Nada preenchido: a rota volta ao ficheiro, **neste idioma só**.
  if v_title is null and v_description is null and p_og_same_as_page is null
     and v_og_title is null and v_og_description is null and v_og_image is null
     and v_og_image_alt is null and v_canonical is null and p_noindex is null then
    delete from public.seo_pages where route = v_route and locale = v_locale;
    return;
  end if;

  insert into public.seo_pages (
    route, locale, title_tag, meta_description, og_same_as_page, og_title,
    og_description, og_image, og_image_alt, canonical, noindex, updated_by
  )
  values (
    v_route, v_locale, v_title, v_description, p_og_same_as_page, v_og_title,
    v_og_description, v_og_image, v_og_image_alt, v_canonical, p_noindex, auth.uid()
  )
  on conflict (route, locale) do update set
    title_tag = excluded.title_tag,
    meta_description = excluded.meta_description,
    og_same_as_page = excluded.og_same_as_page,
    og_title = excluded.og_title,
    og_description = excluded.og_description,
    og_image = excluded.og_image,
    og_image_alt = excluded.og_image_alt,
    canonical = excluded.canonical,
    noindex = excluded.noindex,
    updated_by = auth.uid();
end;
$$;

comment on function public.admin_save_seo_page(
  text, text, text, text, boolean, text, text, text, text, text, boolean
) is
  'Única via de escrita em seo_pages a partir de uma sessão. admin OU marketing '
  '(07 §24.5). Fixa updated_by em auth.uid(); nada preenchido devolve a rota ao ficheiro.';

-- ---------------------------------------------------------------------------
-- 2. A tabela, para o caso de alguém escrever por fora da função
--
-- A policy de escrita era só de admin. A função é `security definer` e não
-- passa por ela, por isso isto não é o que destrava o ecrã — é o que impede a
-- RLS de contradizer a função. Duas regras a discordar sobre quem pode editar
-- SEO resolvem-se sempre no pior momento.
-- ---------------------------------------------------------------------------
drop policy if exists seo_pages_admin_write on public.seo_pages;
create policy seo_pages_internal_write on public.seo_pages
  for all
  using (public.is_admin() or public.is_marketing())
  with check (public.is_admin() or public.is_marketing());

-- ---------------------------------------------------------------------------
-- 3. O registo de auditoria: escrever
--
-- `write_audit_log` exigia `is_staff()`, que não inclui o marketing. Passa a
-- `is_internal()` — a função que existe precisamente para "toda a equipa
-- interna" e que o comentário dela manda usar só onde é essa a intenção.
--
-- Aqui é: o registo de uma ação sensível não é um privilégio de quem a faz, é
-- uma obrigação. Quem pode fazer a ação tem de poder deixar rasto dela — e o
-- contrário, que é o que estava, dava uma área interna inteira a trabalhar sem
-- rasto. A função continua a fixar `actor_id := auth.uid()`, que é o que torna
-- o registo prova de alguma coisa.
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text,
  p_entity text,
  p_entity_id uuid default null,
  p_diff jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if not public.is_internal() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  -- 08 §7.8: limites de comprimento em todos os campos de texto, também quando
  -- quem escreve é código nosso — um `action` de 10 kB torna a tabela ilegível.
  if coalesce(btrim(p_action), '') = '' or length(p_action) > 80 then
    raise exception 'action inválida' using errcode = '22023';
  end if;

  if coalesce(btrim(p_entity), '') = '' or length(p_entity) > 80 then
    raise exception 'entity inválida' using errcode = '22023';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, diff)
  values (v_actor, btrim(p_action), btrim(p_entity), p_entity_id, p_diff)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. O registo de auditoria: ler, e só o que lhe diz respeito
--
-- O painel de SEO lê o `audit_log` por uma razão só: uma página devolvida ao
-- ficheiro não deixa linha em `seo_pages`, e sem o registo essa alteração —
-- das que mais vale a pena ver — não aparecia em sítio nenhum.
--
-- **Não se dá o `audit_log` ao marketing.** Dá-se-lhe as linhas de
-- `seo_pages`, que são as que o ecrã dele mostra. O resto da tabela — planos,
-- flags, moderação, documentos — continua só para o admin. Uma policy por
-- entidade é mais estreita do que um papel a mais na policy de sempre, e é a
-- diferença entre abrir uma porta e abrir a parede.
-- ---------------------------------------------------------------------------
create policy audit_log_marketing_seo_select on public.audit_log
  for select using (public.is_marketing() and entity = 'seo_pages');

comment on policy audit_log_marketing_seo_select on public.audit_log is
  'P10-07: o /marketing/seo lê o rasto das rotas devolvidas ao ficheiro. Só a '
  'entidade seo_pages — o resto do registo continua só para o admin.';
