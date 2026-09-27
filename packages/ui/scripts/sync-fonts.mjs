/**
 * Copia os `.woff2` das fontes variáveis dos pacotes `@fontsource-variable/*`
 * para `src/fonts/files`, onde ficam versionados no repositório.
 *
 * Correr só quando se quiser atualizar as fontes:  pnpm --filter @upm/ui fonts:sync
 *
 * Porque é que os ficheiros estão no repositório e não são lidos de
 * `node_modules` em tempo de build: `next/font/local` resolve caminhos
 * relativos ao módulo, e um caminho para dentro de `node_modules` quebra assim
 * que o gestor de pacotes mudar o layout da store. Versionados, o build é
 * offline, determinístico e não depende do registo npm — o que importa nesta
 * máquina, onde o proxy intercepta o TLS (ver `src/fonts/index.ts`).
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(root, "src", "fonts", "files");
const modules = join(root, "..", "..", "node_modules", "@fontsource-variable");

/** Um corte `latin` e um `latin-ext` por família: PT-PT usa os dois. */
const FILES = [
  ["bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2"],
  ["bricolage-grotesque", "bricolage-grotesque-latin-ext-wght-normal.woff2"],
  ["manrope", "manrope-latin-wght-normal.woff2"],
  ["manrope", "manrope-latin-ext-wght-normal.woff2"],
  ["jetbrains-mono", "jetbrains-mono-latin-wght-normal.woff2"],
  ["jetbrains-mono", "jetbrains-mono-latin-ext-wght-normal.woff2"],
];

mkdirSync(out, { recursive: true });

for (const [pkg, file] of FILES) {
  copyFileSync(join(modules, pkg, "files", file), join(out, file));
  console.log(`✓ ${file}`);
}

// A licença SIL OFL 1.1 exige que a licença siga os ficheiros.
for (const pkg of new Set(FILES.map(([p]) => p))) {
  copyFileSync(join(modules, pkg, "LICENSE"), join(out, `LICENSE-${pkg}.txt`));
  console.log(`✓ LICENSE-${pkg}.txt`);
}
