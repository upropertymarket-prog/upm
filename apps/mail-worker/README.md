# mail-worker

O processo de correio da UProperty Market (P10-03 · 02 §3.2). Corre **fora**
das três apps Next, porque é o único do projeto que usa a `service_role` — e
uma chave que ignora toda a RLS não partilha processo com código que serve
pedidos de browser (02 §3.3).

Faz três coisas:

| O quê                                 | Como                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| **Lê** as caixas do Suporte           | IMAP (`imapflow`), de `mailboxes` para `mail_threads`/`mail_messages` |
| **Envia** as notificações da app      | Resend, drenando `notification_deliveries` (dívida D27)               |
| **Testa** uma caixa a pedido do Admin | `POST /mailboxes/:id/test` — IMAP `LOGIN` + SMTP `AUTH`               |

A credencial de cada caixa vive no Supabase Vault e lê-se por
`mailbox_credential()`, uma função `security definer` com `grant` só para a
`service_role`. Não há outro caminho, nem a partir de uma sessão do Admin.

## Correr localmente

```bash
pnpm --filter @upm/mail-worker dev
```

Precisa de Node ≥ 22.18 (o `dev` corre TypeScript diretamente). Em produção
usa-se `pnpm --filter @upm/mail-worker build && pnpm --filter @upm/mail-worker start`.

## Ambiente

| Variável                    | Obrigatória | Para quê                                                                                                                                     |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | sim         | Projeto Supabase                                                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | sim         | A única chave que lê o Vault e escreve o correio                                                                                             |
| `MAIL_WORKER_TOKEN`         | sim         | Token que o Admin apresenta nos endpoints (≥ 16 caracteres)                                                                                  |
| `RESEND_API_KEY`            | não         | Sem ela, a fila de saída fica por drenar — e o worker diz isso no arranque                                                                   |
| `MAIL_FROM`                 | não         | Remetente das notificações. Por omissão `onboarding@resend.dev`, que só entrega ao e-mail da conta enquanto o domínio não estiver verificado |
| `APP_URL`                   | não         | Base para os links dos e-mails (por omissão `http://localhost:3001`)                                                                         |
| `PORT`                      | não         | 8080                                                                                                                                         |
| `SYNC_INTERVAL_MINUTES`     | não         | 5                                                                                                                                            |
| `OUTBOX_INTERVAL_MINUTES`   | não         | 1                                                                                                                                            |

Do lado do `apps/interno`, o ecrã `/admin/caixas-email` precisa de
`MAIL_WORKER_URL` e do mesmo `MAIL_WORKER_TOKEN` para o botão "Testar ligação"
chegar aqui.

## Endpoints

```
GET  /health              sem token — é o healthcheck do alojamento
POST /mailboxes/:id/test  Bearer <MAIL_WORKER_TOKEN>
POST /sync                força uma passagem por todas as caixas ativas
POST /outbox              força uma drenagem da fila de saída
```

## O que ainda não faz

- **POP3.** `mailboxes.protocol` aceita-o, o worker ainda não: sincroniza e
  testa só IMAP, e diz-o em vez de devolver verde. Entra com `node-pop3`.
- **Enviar a partir da caixa.** O transporte SMTP já está montado (é o que o
  teste de ligação usa), mas quem o chama é o composer do Suporte, em P10-05.
- **Campanhas.** Saem pelo Resend com subdomínio próprio (`news.`), em P10-08 —
  são outra área e outra reputação de envio (07 §24.6).
