# UProperty Market

Plataforma que liga proprietários e compradores/arrendatários diretamente, sem comissões e sem contactos indesejados. Toda a comunicação acontece dentro da plataforma — chat, visitas, documentos e contratos.

**Documentação (Tempo Docs):** 01 PRD · 02 TRD · 03 Fluxo da app · 04 UI/UX Design · 05 Esquema backend · 06 Plano de implementação · **07 Decisões** · **08 Portão de fim de fase**

> Os documentos são a única fonte de verdade. Nenhuma regra de negócio se inventa em código — ver 07 §14.

## Estrutura

```
apps/web         :3000   site público (upropertymarket.pt)
apps/app         :3001   comprador e proprietário (app.upropertymarket.pt)
apps/interno     :3002   admin e suporte (interno.upropertymarket.pt)

packages/ui              componentes partilhados, sobre tokens CSS
packages/db              clientes Supabase e tipos gerados
packages/config          tsconfig base e presets

supabase/migrations      schema versionado
scripts/gate             portão de segurança automatizado
design/prototypes        protótipos .dc.html — fonte visual de verdade
design/brand             logo em claro e escuro
```

Next.js 15 (App Router) · React 19 · TypeScript estrito · Tailwind v4 · Supabase (Postgres 17) · Stripe · Turborepo · pnpm.

## Arrancar

Requisitos: Node ≥ 20.11 e pnpm 9.

```bash
pnpm install
```

Copia `.env.example` para `apps/<app>/.env.local` em cada app e preenche com os valores do projeto Supabase.

```bash
pnpm dev
```

Arranca as três apps em paralelo, cada uma na sua porta.

## Comandos

| Comando                                      | O que faz                                    |
| -------------------------------------------- | -------------------------------------------- |
| `pnpm dev`                                   | As 3 apps em modo de desenvolvimento         |
| `pnpm build`                                 | Build de produção das 3 apps                 |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Verificação                                  |
| `pnpm format`                                | Prettier sobre o monorepo                    |
| `pnpm gate`                                  | Portão de segurança (doc 08)                 |
| `pnpm db:push`                               | Aplica migrações ao projeto ligado           |
| `pnpm db:types`                              | Regenera `packages/db/src/database.types.ts` |
| `pnpm db:diff`                               | Diferenças entre o schema local e o remoto   |

## Regras que não se negoceiam

- **Nada de cores fixas.** Tudo por tokens CSS, para funcionar em claro e escuro (04 §5.2).
- **Tamanho mínimo de texto:** 13 px na app autenticada, 14 px no site público (07 §3).
- **RLS ativa em todas as tabelas.** Toda a leitura sensível passa por RLS; a `service_role` vive apenas em Edge Functions, webhooks e no `mail-worker` (02 §3.3).
- **Toda a mutação** é Server Action com validação `zod` e verificação de papel no servidor.
- **Nenhum segredo com prefixo `NEXT_PUBLIC_`.** O `pnpm gate` falha se aparecer um.
- **Nenhuma fase fecha** sem o portão do doc 08 passado e o relatório escrito.

## Ambientes

`local` · `staging` · `production` (02 §14). As migrações são aplicadas por CI a partir de `supabase/migrations` — nada se altera à mão no dashboard.

## Segredos

Nunca versionados. `.secrets/` e `.env.local` estão no `.gitignore` e o CI verifica o histórico com `gitleaks`.
