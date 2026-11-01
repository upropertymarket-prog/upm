/**
 * Os testes de `@upm/db` correm em série quando há base de dados
 * =========================================================================
 * Metade destes ficheiros (`*-rls.test.ts` e afins) fala com o projeto
 * Supabase real quando encontra credenciais. Todos partilham a mesma base, e
 * cada um cria e autentica as suas contas de teste no `beforeAll`. Em
 * paralelo, a 1 nov 2026, dez ficheiros caíram logo no arranque — o mesmo
 * conjunto passava inteiro quando corrido em série. Um verde que depende de
 * como se corre não é um verde.
 *
 * Sem credenciais (o CI, e quem não as tem), esses ficheiros saltam e o resto
 * são testes puros: ficam em paralelo, como sempre.
 */
import { defineConfig } from "vitest/config";

// Basta o URL para saber que há base: é o que todos os ficheiros que falam
// com ela exigem primeiro. (A chave de serviço não se nomeia aqui — o
// `gate:server` só a admite onde é mesmo usada, e aqui não é.)
const comBase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export default defineConfig({
  test: {
    fileParallelism: !comBase,
  },
});
