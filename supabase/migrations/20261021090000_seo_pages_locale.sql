-- ---------------------------------------------------------------------------
-- `seo_pages` por rota **e idioma** (D72 fase C · 07 §24.5)
-- ===========================================================================
-- A tabela nasceu a 8 out 2026 com `route` por chave primária, e nessa data
-- estava certa: o site era monolíngue. Desde 20 out serve duas línguas, e a
-- chave de uma coluna passou a ser um defeito com uma consequência concreta:
--
--   **quem corrigisse um título em produção corrigia-o nos dois idiomas ao
--   mesmo tempo** — e escrevia texto português na versão inglesa, ou o
--   contrário, sem ter como saber que o estava a fazer.
--
-- É a última das três fases do SEO bilingue. A fase A pôs os `seo.ts` com os
-- dois idiomas e a B pôs o `/en` com canonical e `hreflang` por versão. As
-- duas resolveram o valor **versionado**; esta resolve a camada editável, que
-- era a única que continuava a tratar as duas línguas como uma.
--
-- ## A chave passa a ser `(route, locale)`
--
-- E não uma coluna `title_tag_en` ao lado da portuguesa. A razão é que a
-- segunda forma não escala com `LOCALES`: acrescentar um idioma passaria a ser
-- uma migração com nove colunas novas, e cada leitura teria de saber escolher
-- o sufixo. Com a linha por idioma, um idioma novo não mexe no esquema — e é
-- também a forma que faz o `delete` de "volta ao ficheiro" funcionar por
-- idioma, que é precisamente o que faltava.
--
-- ## O que acontece às linhas que já existem
--
-- **Duplicam-se para os dois idiomas**, por decisão do cliente a 21 out 2026.
-- É o que preserva exatamente o comportamento de hoje: uma linha existente
-- aplicava-se às duas línguas, e atribuí-la só ao português faria uma correção
-- feita no painel desaparecer do lado inglês no próximo deploy — uma alteração
-- de conteúdo em produção a desfazer-se sozinha, sem aviso. Quem quiser as
-- duas línguas diferentes separa-as no painel, que é uma edição deliberada.
--
-- O registo de predefinições (`route = '*'`, 04 §2.1.1) segue a mesma regra e
-- pela mesma razão: predefinições inglesas herdadas do português são o mesmo
-- defeito que a fase A corrigiu nas rotas, um nível acima.
-- ---------------------------------------------------------------------------

-- O domínio é o `LOCALES` de `packages/config/i18n.ts`. Repetido aqui porque a
-- base de dados não pode importar TypeScript — e um `check` é melhor do que
-- nada: sem ele, um `locale` escrito com erro criava uma linha fantasma que
-- nenhuma leitura iria procurar e que o painel não mostrava.
alter table public.seo_pages
  add column locale text not null default 'pt'
    constraint seo_pages_locale_shape check (locale in ('pt', 'en'));

comment on column public.seo_pages.locale is
  'Idioma a que esta sobreposição se aplica. Ver LOCALES em @upm/config.';

-- O `default 'pt'` acima já marcou as linhas existentes como portuguesas; o
-- que falta é a cópia inglesa. Feito **antes** de trocar a chave primária, com
-- a antiga ainda a garantir que não há duplicados de onde copiar.
--
-- `updated_by` e `updated_at` copiam-se tal e qual: a cópia não é uma edição
-- de ninguém, é a mesma decisão a aplicar-se a outra língua, e inventar um
-- autor para ela seria pôr no rasto de auditoria uma alteração que não houve.
insert into public.seo_pages (
  route, locale, title_tag, meta_description, og_same_as_page, og_title,
  og_description, og_image, og_image_alt, canonical, noindex, updated_by,
  created_at, updated_at
)
select
  route, 'en', title_tag, meta_description, og_same_as_page, og_title,
  og_description, og_image, og_image_alt, canonical, noindex, updated_by,
  created_at, updated_at
from public.seo_pages
where locale = 'pt';

-- O `canonical` é a exceção à cópia, e tem de ser limpo na versão inglesa.
-- Um canonical é um URL concreto: copiado, a página `/en/terms` anunciaria
-- `https://upropertymarket.pt/termos` como canónica dela — exatamente o
-- canonical cruzado que a fase B tirou do `buildMetadata`, e que diria ao
-- Google para deitar fora a tradução toda. Nulo devolve o cálculo ao
-- `buildMetadata`, que sabe fazê-lo por idioma.
update public.seo_pages set canonical = null where locale = 'en';

-- A troca da chave. O nome da constraint antiga é o que o Postgres lhe deu
-- quando `route` era `primary key`.
alter table public.seo_pages drop constraint seo_pages_pkey;
alter table public.seo_pages add primary key (route, locale);

-- O `default` sai agora que a chave o exige: uma linha inserida sem idioma
-- deixa de ser um erro silencioso que cai em português e passa a ser um erro.
-- A `admin_save_seo_page` é a única via de escrita de uma sessão e passa-o
-- sempre; quem escrever à mão na tabela tem de dizer qual.
alter table public.seo_pages alter column locale drop default;

-- ---------------------------------------------------------------------------
-- admin_save_seo_page — o mesmo contrato, com o idioma
--
-- `p_locale` entra **em segundo lugar** e não no fim, apesar de isso obrigar a
-- apagar e recriar a função em vez de a substituir: é a chave da linha, e uma
-- chave que aparece depois de nove campos de conteúdo lê-se como se fosse
-- opcional. Não tem valor por omissão pela mesma razão que a coluna o perdeu.
--
-- O resto do comportamento mantém-se palavra por palavra, incluindo as duas
-- decisões que a função existe para garantir: `updated_by` fixa-se em
-- `auth.uid()` e nunca é aceite de quem chama, e uma linha sem nada é apagada
-- — agora **só a desse idioma**, que é o ponto de toda esta migração: devolver
-- a versão inglesa ao ficheiro deixa de mexer na portuguesa.
-- ---------------------------------------------------------------------------

drop function if exists public.admin_save_seo_page(
  text, text, text, boolean, text, text, text, text, text, boolean
);

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
  if not public.is_admin() then
    raise exception 'not_authorized' using hint = 'not_authorized';
  end if;

  if v_route <> '*' and v_route !~ '^/[^[:space:]]*$' then
    raise exception 'invalid_route' using hint = 'invalid_route';
  end if;

  -- Recusado em vez de cair em português. Um idioma inválido que caísse no
  -- valor por omissão escrevia texto inglês na linha portuguesa — a mesma
  -- confusão de línguas que esta migração existe para acabar.
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

revoke all on function public.admin_save_seo_page(
  text, text, text, text, boolean, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.admin_save_seo_page(
  text, text, text, text, boolean, text, text, text, text, text, boolean
) to authenticated;
