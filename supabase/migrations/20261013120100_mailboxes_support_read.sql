-- ---------------------------------------------------------------------------
-- O Suporte passa a ler a lista de caixas (P10-04)
--
-- A migração de P10-03 deixou `mailboxes` fechada ao Admin, com a razão
-- escrita: "o Suporte vai precisar de ler a lista para o seletor de caixa de
-- `/suporte/email`, mas isso é P10-04 e abre-se lá, com a policy que esse ecrã
-- justificar — abrir agora seria dar leitura a quem ainda não tem ecrã nenhum
-- que a use". O ecrã existe; a policy abre-se aqui.
--
-- **O que o Suporte passa a ver é a configuração, não a credencial.** A coluna
-- `secret_id` é um identificador do Vault e, como lá está escrito, sozinho não
-- abre nada: decifrar exige `mailbox_credential()`, que tem `grant` só para a
-- `service_role`. O que esta policy dá é o que o seletor precisa — endereço,
-- nome, departamento e estado.
--
-- Fica `is_staff()` e não `is_support()` porque o Admin já lê (tem a sua
-- própria policy desde P10-03); escrever continua a ser só dele.
-- ---------------------------------------------------------------------------

create policy mailboxes_staff_select on public.mailboxes
  for select using (public.is_staff());
