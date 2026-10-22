/// <reference types="vite/client" />

/**
 * Os tipos do cliente Vite — e, com eles, os módulos de asset (`*.svg`,
 * `*.png`, …) que o `Brand.tsx` importa.
 * =========================================================================
 * Até 22 out 2026 quem declarava os `*.svg` para o sidecar era o
 * `tempo/next-env.d.ts`, através do `/// <reference types="next/image-types/
 * global" />`. Só que o sidecar deixou de ser um host Next: é Vite. O
 * `next-env.d.ts` ficou lá como resto, é gerado pelo `next dev` e desaparece
 * quando alguém limpa a pasta — e quando desapareceu, o `pnpm gate:canvas`
 * passou a falhar com `Cannot find module './brand/logo-light.svg'` em cima de
 * um ficheiro que não tinha mudado.
 *
 * Este ficheiro é a declaração que corresponde ao host que existe hoje. Não
 * substitui o `next-env.d.ts` por decreto — deixa é de depender dele.
 */
