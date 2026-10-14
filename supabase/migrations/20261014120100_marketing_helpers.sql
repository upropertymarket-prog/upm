-- ---------------------------------------------------------------------------
-- O Marketing passa a ser área própria, parte 2/3 — quem é quem
--
-- `is_staff()` **não** passa a incluir o marketing, e esta é a decisão mais
-- importante do ficheiro (07 §24.6). Hoje `is_staff()` quer dizer
-- `admin | support` e está escrita em políticas de tabelas que o marketing não
-- tem de ver: moderação de imóveis, leads do site, diretório de utilizadores,
-- tickets, correio do Suporte. Alargá-la seria dar tudo isso de uma vez, em
-- silêncio, com uma linha de uma migração — e ninguém voltaria a saber quais
-- das dezenas de políticas existentes mudaram de alcance nesse dia.
--
-- Nascem duas funções em vez disso:
--
-- - `is_marketing()`, a gémea de `is_support()`: só o papel novo.
-- - `is_internal()` = `admin | support | marketing`, **só onde a intenção é
--   mesmo "qualquer pessoa da equipa interna"** — a Cloud partilhada é o caso
--   nomeado em 07 §24.6. Não é um `is_staff()` novo: é um predicado diferente,
--   com um nome que diz o que inclui.
--
-- A regra que fica: **cada política nova diz explicitamente quem**, e nenhuma
-- política existente é alargada sem ser nomeada.
-- ---------------------------------------------------------------------------

create or replace function public.is_marketing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'marketing' from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_marketing() is
  'Verdadeiro para o papel marketing. A gémea de is_support(); is_staff() NÃO o inclui (07 §24.6).';

create or replace function public.is_internal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'support', 'marketing') from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_internal() is
  'admin | support | marketing. Para usar SÓ onde a intenção é toda a equipa interna — p.ex. a Cloud partilhada (07 §24.6). Não substitui is_staff().';

revoke all on function public.is_marketing() from public, anon;
revoke all on function public.is_internal() from public, anon;
grant execute on function public.is_marketing() to authenticated, service_role;
grant execute on function public.is_internal() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- `is_internal()` nasce sem nenhum chamador, e é deliberado
--
-- O caso que 07 §24.6 nomeia para ela é a **Cloud interna**, que a tabela da
-- mesma secção põe em `/suporte/cloud` e `/marketing/cloud` como trabalho de
-- **P10-10**. As políticas de `folders` e `files` para `cloud_scope = 'staff'`
-- existem desde a Fase 6 escritas a `is_staff()`, e reescrevê-las agora seria
-- fazer exatamente o que a nota de topo deste ficheiro diz que não se faz:
-- alargar o alcance de políticas existentes numa fase em que ninguém tem ecrã
-- para o exercer nem razão para o revisitar.
--
-- Há ainda um segundo troço que a Cloud partilhada vai precisar e que não é
-- óbvio: a política `cloud_objects_owner` do bucket `cloud` compara o primeiro
-- segmento do caminho com `auth.uid()`, logo um ficheiro de scope `staff`
-- carregado pelo Suporte **não é legível pelo Marketing** mesmo com a linha de
-- `files` aberta. Isso resolve-se com uma política própria, emparelhada por
-- `storage_path` como já faz `cloud_objects_shared_select` — e resolve-se em
-- P10-10, ao lado do ecrã que a torna verificável.
--
-- Fica escrito aqui para que em P10-10 ninguém descubra isto a partir de um
-- "transferir" que devolve 403.
-- ---------------------------------------------------------------------------
