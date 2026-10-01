-- UProperty Market — Fase 6, correção à parte 1/3
--
-- `files_insert_own` (20260930120000_cloud.sql) deixava a aplicação inserir
-- diretamente em `files`. Isso contorna `cloud_register_upload` — e com ele a
-- verificação de quota de 07 §19.8 #1 — por inteiro: bastava carregar o objeto
-- no próprio prefixo do bucket e inserir a linha à mão para ter Cloud
-- ilimitada, com plano Gratuito.
--
-- A tabela passa ao padrão de `auth_attempts` (Fase 3) e de
-- `document_access_log`: leitura por policy, escrita só por função
-- `security definer`. É também o que o doc 08 §2.2 pede — pelo menos uma
-- policy, ainda que nenhum papel escreva diretamente.
--
-- `update` e `delete` mantêm-se: renomear e mover um ficheiro não mexe na
-- quota (a quota soma `file_versions.size`, não `files.size`), e o WITH CHECK
-- já impede pôr `source = 'property_document'` para se isentar.

drop policy files_insert_own on public.files;

comment on table public.files is
  'Cloud do utilizador. Linhas nascem SÓ por cloud_register_upload / '
  'ensure_property_folders — não há policy de insert, de propósito: a quota '
  'de 07 §19.8 vive nessas funções e um insert direto passava-lhe ao lado.';
