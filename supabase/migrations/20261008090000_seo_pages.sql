-- ---------------------------------------------------------------------------
-- `seo_pages` — a camada editável por cima do `seo.ts` (P2-06 · 07 §24.5)
-- ===========================================================================
-- A primeira metade de P2-06 pôs a fonte de verdade em código: um `seo.ts` por
-- rota, versionado, com `check-seo` a falhar o PR de uma rota pública que não o
-- tenha. Esta é a segunda metade, e a razão de existir é uma só: **o marketing
-- corrigir um título em produção sem esperar por um deploy**.
--
-- As duas camadas não competem, e a ordem importa:
--
--   * o **ficheiro** é o valor por omissão e é quem sabe que páginas existem.
--     Uma rota nova sem SEO tem de falhar o PR, não ficar à espera de alguém se
--     lembrar de a preencher num painel. Uma tabela nunca saberia que a rota
--     passou a existir;
--   * a **tabela** é a sobreposição, campo a campo, e só onde há valor. Um
--     campo apagado no Admin devolve o controlo ao ficheiro em vez de publicar
--     um título vazio — a regra já está escrita no `buildMetadata` e os testes
--     dele cobrem-na.
--
-- `route = '*'` é o registo de predefinições de 04 §2.1.1. Não é tratado de
-- forma especial aqui: é uma linha como as outras, e é a aplicação que lhe dá
-- o significado de "fundo de escada". Fica assim porque a alternativa — uma
-- segunda tabela de um registo só — é pior de ler e igual de usar.
--
-- **A leitura é pública e é deliberado.** Tudo o que esta tabela guarda acaba
-- impresso no HTML servido a quem abre a página: título, descrição, imagem de
-- partilha, canonical. Esconder atrás de uma sessão aquilo que é publicado em
-- texto limpo não protegeria nada e obrigaria o site público — que corre sem
-- sessão nenhuma — a usar a chave de serviço para se desenhar a si próprio.
-- Escrever é outra coisa: só admin, e é a `with check` que o garante.
-- ---------------------------------------------------------------------------

create table public.seo_pages (
  -- A rota é a chave: há no máximo um registo por página, e é por ela que o
  -- `buildMetadata` procura. Sem `id` sintético — não haveria nada que ele
  -- resolvesse e haveria um segundo caminho para a mesma linha.
  route text primary key,

  -- Todos os campos são anuláveis **de propósito**: nulo significa "o ficheiro
  -- manda", e é esse o comportamento por omissão de uma linha acabada de criar.
  title_tag text,
  meta_description text,
  og_same_as_page boolean,
  og_title text,
  og_description text,
  og_image text,
  og_image_alt text,
  canonical text,
  noindex boolean,

  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ou um caminho absoluto, ou o registo de predefinições. Um valor como
  -- "termos" (sem barra) nunca corresponderia a rota nenhuma e ficaria a
  -- ocupar a lista do Admin a prometer um efeito que não tem.
  constraint seo_pages_route_shape check (route = '*' or route ~ '^/[^[:space:]]*$'),

  -- Limites de sanidade, não os limites de SEO. Os 60 e os 160 caracteres de
  -- 04 §2.1.1 são conselho — um título a 63 caracteres é truncado pelo Google,
  -- não é inválido —, e por isso vivem no contador do editor e no aviso do
  -- `check-seo`, onde se podem ultrapassar com conhecimento de causa. O que a
  -- base de dados recusa é só o que nunca é intencional.
  constraint seo_pages_title_len check (title_tag is null or char_length(title_tag) <= 200),
  constraint seo_pages_description_len check (
    meta_description is null or char_length(meta_description) <= 400
  ),
  constraint seo_pages_og_title_len check (og_title is null or char_length(og_title) <= 200),
  constraint seo_pages_og_description_len check (
    og_description is null or char_length(og_description) <= 400
  ),
  constraint seo_pages_og_image_alt_len check (
    og_image_alt is null or char_length(og_image_alt) <= 300
  ),
  -- A imagem é um caminho em `public/` ou um URL absoluto; o canonical é
  -- sempre absoluto, porque é isso que um `<link rel="canonical">` exige para
  -- não ser interpretado como relativo ao domínio errado numa partilha.
  constraint seo_pages_og_image_shape check (
    og_image is null or og_image = '' or og_image ~ '^(/|https?://)'
  ),
  constraint seo_pages_canonical_shape check (
    canonical is null or canonical = '' or canonical ~ '^https?://'
  )
);

comment on table public.seo_pages is
  'Sobreposição editável de SEO por rota (P2-06). O valor por omissão vive em '
  'apps/web/src/app/<rota>/seo.ts; aqui só fica o que o Admin alterou. Nulo = '
  'usa o ficheiro. route = ''*'' é o registo de predefinições (04 §2.1.1).';
comment on column public.seo_pages.route is
  'Caminho da página ("/", "/termos") ou ''*'' para as predefinições.';
comment on column public.seo_pages.og_same_as_page is
  'Ligado: og:title/og:description herdam o título e a descrição da página.';

create trigger seo_pages_set_updated_at
  before update on public.seo_pages
  for each row execute function public.set_updated_at();

alter table public.seo_pages enable row level security;

-- Leitura por toda a gente, incluindo `anon`: ver a nota no topo. O site
-- público lê isto sem sessão, para se desenhar a si próprio.
create policy seo_pages_public_select on public.seo_pages
  for select using (true);

-- Escrita só de admin. `using` e `with check` aos dois, senão um admin podia
-- mover uma linha para fora do seu próprio alcance numa atualização.
create policy seo_pages_admin_write on public.seo_pages
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_save_seo_page — a única via de escrita a partir de uma sessão
--
-- Podia ser um `upsert` direto à tabela, que a RLS já protegia. É uma função
-- por duas razões que o `upsert` não dava:
--
--   1. **`updated_by` fixa-se em `auth.uid()`** e não é aceite de quem chama. É
--      a mesma lição do `write_audit_log` (07 §20.7): um campo "quem alterou"
--      que o cliente escolhe deixa de ser prova de alguma coisa.
--   2. **Uma linha sem nada é apagada.** Quem limpa todos os campos no Admin
--      está a dizer "volta ao ficheiro", e deixar a linha vazia na tabela
--      faria a lista do Admin mostrar para sempre páginas "personalizadas" que
--      não personalizam nada.
--
-- Cadeia vazia e nulo são a mesma coisa à entrada: um `<input>` limpo chega
-- como `''`, e tratá-lo como "sobrepõe com vazio" publicaria um título em
-- branco — exatamente o que `buildMetadata` recusa fazer do outro lado.
-- ---------------------------------------------------------------------------

create or replace function public.admin_save_seo_page(
  p_route text,
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

  -- Nada preenchido: a rota volta ao ficheiro.
  if v_title is null and v_description is null and p_og_same_as_page is null
     and v_og_title is null and v_og_description is null and v_og_image is null
     and v_og_image_alt is null and v_canonical is null and p_noindex is null then
    delete from public.seo_pages where route = v_route;
    return;
  end if;

  insert into public.seo_pages (
    route, title_tag, meta_description, og_same_as_page, og_title, og_description,
    og_image, og_image_alt, canonical, noindex, updated_by
  )
  values (
    v_route, v_title, v_description, p_og_same_as_page, v_og_title, v_og_description,
    v_og_image, v_og_image_alt, v_canonical, p_noindex, auth.uid()
  )
  on conflict (route) do update set
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
  text, text, text, boolean, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.admin_save_seo_page(
  text, text, text, boolean, text, text, text, text, text, boolean
) to authenticated;
