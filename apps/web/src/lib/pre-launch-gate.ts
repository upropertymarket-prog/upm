import type { LaunchMode } from "./launch-mode-override";
import { pathnames } from "../i18n/pathnames";

/**
 * O que o site serve em pré-lançamento (12 §34.3 e §34.5)
 * =========================================================================
 * Decisão do cliente (4 e 5 nov 2026): **em `pre`, o site público é a página
 * de pré-lançamento** — com o formulário de pré-inscrição e as páginas legais —
 * e mais nada. Quem escrever outro endereço (`/criar-conta`, `/entrar`,
 * `/propriedades`, um endereço que não existe) volta à página de
 * pré-lançamento. Não é um 404: é sempre o site, e o site é aquela página.
 *
 * A lista é **branca**: o que não estiver aqui não se serve. Uma página nova
 * fica fechada em `pre` até alguém a juntar de propósito — o contrário (uma
 * lista do que se fecha) deixava abrir o registo só por se esquecer de a
 * atualizar, que foi o que aconteceu ao `/criar-conta` até 5 nov.
 *
 * As rotas técnicas (`/api/*`, `/auth/*`, `robots.txt`, `sitemap.xml`, `og/`)
 * nem chegam aqui: ficam fora do `matcher` do middleware.
 */
const ABERTAS_NO_PRE = [
  "/",
  "/pre-inscricao",
  "/pre-inscricao/confirmar",
  // O link "remover a minha pré-inscrição" do e-mail de confirmação (8 nov
  // 2026): fechá-lo era tirar a quem se inscreveu a forma de apagar os dados.
  "/pre-inscricao/remover",
  "/termos",
  "/privacidade",
  "/cookies",
  // O link de "deixar de receber" vai nos e-mails da pré-inscrição (02 §4.3):
  // fechá-lo seria tirar a quem se inscreveu a forma de sair.
  "/cancelar-subscricao",
] as const satisfies ReadonlyArray<keyof typeof pathnames>;

const CAMINHOS_ABERTOS = new Set<string>(
  ABERTAS_NO_PRE.flatMap((chave) => {
    const entrada = pathnames[chave] as string | Record<string, string>;
    return typeof entrada === "string" ? [entrada] : Object.values(entrada);
  }),
);

const PREFIXO_DE_IDIOMA = /^\/(pt|en)(?=\/|$)/;

/**
 * Para onde vai um pedido em `pre`: `null` se a página se serve, ou o caminho
 * da página de pré-lançamento no idioma em que se pediu.
 */
export function destinoNoPre(pathname: string): string | null {
  const idioma = PREFIXO_DE_IDIOMA.exec(pathname)?.[1];
  const semIdioma = pathname.replace(PREFIXO_DE_IDIOMA, "").replace(/\/+$/, "") || "/";

  if (CAMINHOS_ABERTOS.has(semIdioma)) return null;
  // Um ficheiro de `public/` (`/brand/logo.svg`) não é uma página: o
  // redirecionamento partia o logótipo da própria página de pré-lançamento.
  if (/\.[a-z0-9]+$/i.test(semIdioma)) return null;

  return idioma === "en" ? "/en" : "/";
}

export function deveRedirecionar(modo: LaunchMode, pathname: string): string | null {
  return modo === "pre" ? destinoNoPre(pathname) : null;
}
