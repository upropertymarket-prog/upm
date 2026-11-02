/**
 * E2E por papel (12 §5.1.1 e §11 · §25 A5)
 * =========================================================================
 * Os testes de RLS provam a base de dados; estes provam **o sistema todo**:
 * middleware, Server Action, função SQL e política, pela mesma porta por onde
 * entra um utilizador. São o substituto declarado do portão de Server Actions
 * que se decidiu não escrever (§5.1.1): um regex não prova que um comprador
 * que tenta a ação do proprietário é recusado; isto prova.
 *
 * ## As apps — servidores próprios, ao lado dos de trabalho
 *
 * Correm em `next dev` nas portas **4400 www, 4401 app, 4402 interno**, e
 * compilam para `.next-e2e`. Assim os E2E nunca tocam nos dev servers de
 * quem está a trabalhar (4300–4302): nem nas portas, nem no `.next`, cuja
 * partilha deixa um `next dev` a dar 500 em todas as rotas. Os URLs entre
 * apps (`WEB_URL`, `APP_URL`, `INTERNO_URL`) são reescritos para estas
 * portas; o resto vem do `.env.local` de cada app, como sempre.
 *
 * Se as 4400–4402 já estiverem de pé (uma corrida anterior deixada aberta),
 * são reaproveitadas em vez de duplicadas.
 *
 * ## A base
 *
 * O projeto Supabase real (o único que há — "staging"). As contas são
 * `e2e-…@upropertymarket.test`, criadas e apagadas por cada corrida. Sem
 * credenciais, os testes saltam, como os `*-rls.test.ts`.
 *
 * Um ficheiro de cada vez (`workers: 1`): todos partilham a mesma base, e foi
 * o paralelo que deitou abaixo dez ficheiros de `@upm/db` a 1 nov.
 */
import { defineConfig, devices } from "@playwright/test";

import { APP, INTERNO, WEB } from "./lib/ambiente";

const APPS = [
  { filtro: "@upm/web", url: WEB },
  { filtro: "@upm/app", url: APP },
  { filtro: "@upm/interno", url: INTERNO },
] as const;

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  // `next dev` compila cada rota na primeira visita: o primeiro acesso a uma
  // página pode levar dezenas de segundos. Os tempos dizem isso, não pressa.
  timeout: 180_000,
  // A primeira visita a cada página compila-a; uma verificação logo a seguir
  // a uma navegação espera por isso.
  expect: { timeout: 60_000 },
  // Uma repetição, e só uma. No Windows, o `next dev` a compilar várias rotas
  // ao mesmo tempo esbarra em ficheiros que o antivírus está a ler
  // (`UNKNOWN: unknown error, open …webpack-runtime.js`, visto a 2 nov) e a
  // página dá 500 sem culpa da app. Um defeito real falha as duas vezes; e o
  // relatório marca como "flaky" o que só passou à segunda — não se esconde.
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    locale: "pt-PT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 120_000,
    // Um clique que submete espera pela navegação, e a primeira visita a uma
    // rota compila-a: 30 s não chegam no arranque a frio do `next dev`.
    actionTimeout: 120_000,
  },
  webServer: APPS.map(({ filtro, url }) => ({
    command: `pnpm --filter ${filtro} exec next dev --port ${new URL(url).port}`,
    cwd: "../..",
    url: `${url}/api/health`,
    env: {
      UPM_NEXT_DIST_DIR: ".next-e2e",
      WEB_URL: WEB,
      APP_URL: APP,
      INTERNO_URL: INTERNO,
    },
    reuseExistingServer: true,
    timeout: 480_000,
    stdout: "pipe" as const,
    stderr: "pipe" as const,
  })),
});
