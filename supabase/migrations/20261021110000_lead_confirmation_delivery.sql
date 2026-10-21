-- ---------------------------------------------------------------------------
-- A fila de saída passa a aceitar quem ainda não tem conta (P2-02 · fecha o
-- double opt-in de `20261007150100_site_lead_intake.sql`)
-- ===========================================================================
-- `submit_site_lead` devolve um `confirm_token` desde 7 out e **nunca ninguém
-- o enviou**: a Server Action tinha um TODO no lugar do e-mail. A consequência
-- não é cosmética — a migração do intake é explícita em dizer que a linha
-- nasce com `confirmed_at` nulo e que *"só conta como lead depois de o e-mail
-- ser confirmado"*. Sem e-mail, **nenhuma pré-inscrição conta como lead**. O
-- formulário recolhe, o CRM mostra, e nada daquilo é um contacto válido.
--
-- O relay existe (Resend), o `mail-worker` drena `notification_deliveries`
-- desde P10-03, e o modelo transacional está escrito. Faltava uma coisa só:
-- a fila exige um `profile_id`, e quem se pré-inscreve **não tem conta**. É
-- esse o único obstáculo que esta migração remove.
--
-- ## Porque é a fila, e não um envio direto da action
--
-- A alternativa era a action falar com o Resend por ela própria. Seria menos
-- uma migração e mais uma forma de perder e-mails: um relay em baixo durante
-- dez segundos devolve um erro à action, e a pessoa fica com "verifique a sua
-- caixa" na página e nada na caixa. A fila foi construída para exactamente
-- isto — marcar antes de enviar, devolver à fila com o motivo, desistir às
-- cinco tentativas (ver a nota de topo de `outbox.ts`) — e a lição de D27 foi
-- precisamente a de e-mails que o produto promete e não envia.
--
-- ## O que `profile_id` nulo significa, e o que não significa
--
-- Nulo = **o destinatário não tem conta**. A entrega vale pelo `recipient`,
-- que é a coluna que o `outbox.ts` lê; o `profile_id` só servia para as
-- preferências de notificação do `notify()`, e um visitante não tem
-- preferências para consultar. Não há aqui nenhum caminho novo: o `notify()`
-- continua a exigir um perfil, porque continua a ler `notification_prefs`.
--
-- O `on delete cascade` mantém-se para as entregas que **têm** perfil: apagar
-- uma conta continua a levar a sua fila atrás.
-- ---------------------------------------------------------------------------

alter table public.notification_deliveries
  alter column profile_id drop not null;

comment on column public.notification_deliveries.profile_id is
  'Nulo quando o destinatário não tem conta — a confirmação de pré-inscrição '
  '(P2-02) é o primeiro caso. A entrega vale pelo `recipient`; o perfil só '
  'serve as preferências de notificação do notify(), que um visitante não tem.';

-- O índice de agrupamento é `(profile_id, group_key) where group_key is not
-- null`, e em Postgres dois nulos são distintos: para quem não tem conta, ele
-- não agrupa nada. Não se corrige aqui de propósito — a confirmação de
-- pré-inscrição **não quer** ser agrupada, quer ser substituída, porque cada
-- submissão gera um token novo que invalida o anterior. Quem enfileira é que
-- cancela a entrega anterior (ver a action), e isso é uma decisão de quem
-- escreve, não uma propriedade do índice.
