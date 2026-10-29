-- ---------------------------------------------------------------------------
-- Índices nas colunas por onde o RLS filtra (12 §10.3)
-- ---------------------------------------------------------------------------
-- Uma política de RLS é avaliada **por linha lida**. Se a coluna do filtro não
-- tiver índice, cada leitura varre a tabela inteira — e a conta não cresce com
-- o número de pedidos, cresce com o produto dos dois. É a causa mais comum de
-- uma app Supabase passar de rápida a inutilizável sem nada no código ter
-- mudado: só a tabela ficou grande.
--
-- O Postgres **não** cria índice para uma chave estrangeira. Cria para a chave
-- primária e para o `unique`, e é essa assimetria que faz estes casos
-- passarem despercebidos: a coluna tem `references`, parece coberta, e não
-- está.
--
-- Foram as duas únicas que faltavam, de 63 tabelas com políticas que filtram
-- por coluna. Um terceiro candidato, `messages.sender_id`, foi descartado
-- depois de lido: só aparece num `with check` de INSERT, que avalia a linha a
-- inserir e não varre nada.

-- `app_update_views` é a que cresce depressa: uma linha por pessoa e por
-- atualização publicada. Com 100 mil contas e 20 atualizações são 2 milhões de
-- linhas, e `app_updates_for_me()` lê-a por `profile_id` a cada abertura da
-- app.
--
-- Os índices que já existiam — `(update_id, profile_id)` e `(update_id)` —
-- servem a pergunta "quem viu esta atualização?", que é a do Marketing. Não
-- servem "o que é que esta pessoa ainda não viu?", que é a de toda a gente,
-- todos os dias: num índice composto, filtrar só pela segunda coluna não
-- aproveita a árvore.
create index if not exists app_update_views_profile_idx
  on public.app_update_views (profile_id);

-- Volume muito menor, mas a política filtra por aqui e o custo de um índice
-- numa tabela pequena é desprezável. Fica pela mesma razão que o outro: a
-- coluna é FK e parecia coberta.
create index if not exists trial_extension_requests_profile_idx
  on public.trial_extension_requests (profile_id);
