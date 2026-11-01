/**
 * O que a borda pode guardar, e por quanto tempo (12 §10.4)
 * ===========================================================================
 * Hoje o site **não envia `Cache-Control` nenhum**. Sem instrução, uma CDN não
 * guarda nada e cada visita volta a render no servidor — que é exatamente o
 * que torna um pico de tráfego num problema de base de dados.
 *
 * Este módulo diz, por caminho, o que pode ser partilhado entre visitantes.
 * A regra é uma só e vale a pena escrevê-la: **só entra em cache partilhada o
 * que é igual para toda a gente**. Um ecrã com um formulário de entrada, um
 * token de confirmação ou qualquer coisa ligada a uma pessoa fica de fora, sem
 * exceções e sem discussão — servir a página de alguém a outra pessoa é a
 * falha mais grave que uma cache sabe produzir.
 *
 * ## Lista branca, não lista negra
 *
 * O caminho que não estiver aqui **não** é guardado. É o sentido certo do
 * erro: esquecer de acrescentar uma página nova à lista custa desempenho;
 * esquecer de a excluir custa uma fuga de dados.
 *
 * ## O que isto ainda NÃO resolve
 *
 * Duas coisas, e nenhuma é código (12 §10.4, bloqueadas em C1):
 *
 *  1. **O site envia `Set-Cookie: upm-locale` em cada resposta.** O Cloudflare,
 *     por omissão, não guarda respostas com `Set-Cookie` — e com razão, porque
 *     entregar o cookie de um visitante a outro é o mesmo erro com outro nome.
 *     Aqui é só o idioma, e o idioma já está no URL, por isso é seguro mandar
 *     a borda ignorá-lo **nestes caminhos** com uma Cache Rule. O cookie não se
 *     pode simplesmente desligar: é ele que leva a escolha de língua do site
 *     para o `app.*`, que não tem prefixo de idioma (ver `i18n/routing.ts`).
 *  2. **Não há CDN.** Até haver, estes cabeçalhos não mudam nada de medível —
 *     o `s-maxage` é instrução para caches partilhadas, e o browser de cada
 *     pessoa ignora-o em favor do `max-age`, que fica a zero de propósito.
 *
 * ## E porque é que não é ISR
 *
 * Porque não pode ser: o `layout.tsx` lê `headers()` para o nonce da CSP, e
 * `headers()` torna a árvore inteira dinâmica. Um `export const revalidate`
 * nestas páginas não faria nada. A alternativa seria trocar o nonce por
 * hashes, e isso esbarra nos scripts que o próprio Next injeta. Entre
 * enfraquecer a CSP e guardar na borda uma página renderizada, guarda-se na
 * borda — a página é pública e igual para todos, e a CSP continua estrita.
 */

/**
 * `s-maxage` é para a CDN; `max-age=0` mantém o browser a perguntar.
 *
 * `stale-while-revalidate` é o que transforma isto numa defesa a sério: num
 * pico, a borda continua a servir a versão que tem enquanto vai buscar a nova
 * em segundo plano, em vez de deixar passar mil pedidos ao mesmo tempo.
 */
// Montado por diretivas e não num template literal, como em
// `buildContentSecurityPolicy`: um `"public, max-age=0, s-maxage="` tem
// espaços e letras, e o `gate:i18n` — com razão na forma — lê isso como uma
// frase de ecrã escrita à mão.
const partilhado = (segundos: number, obsoleto: number) =>
  ["public", "max-age=0", `s-maxage=${segundos}`, `stale-while-revalidate=${obsoleto}`].join(", ");

/**
 * Um minuto para o catálogo, cinco para o resto.
 *
 * A camada de dados já guarda 300 s com invalidação por etiqueta
 * (`public-listings.ts`), por isso o que isto acrescenta é poupar a
 * renderização, não a consulta. Sessenta segundos é a janela em que um anúncio
 * novo pode ainda não aparecer — e `revalidateTag` não alcança a CDN, só a
 * cache do Next, o que é mais uma razão para a janela ser curta.
 */
const CATALOGO = partilhado(60, 600);
const ESTAVEL = partilhado(300, 3600);

/**
 * Os caminhos, já sem o prefixo de idioma. `as-needed` significa que o
 * português não o leva e o inglês leva — as duas formas têm de bater na mesma
 * regra, senão metade do site fica sem cache sem ninguém reparar.
 */
const REGRAS: ReadonlyArray<{ padrao: RegExp; valor: string }> = [
  // A home e o catálogo, com ou sem filtros.
  { padrao: /^\/$/, valor: CATALOGO },
  { padrao: /^\/(propriedades|properties)$/, valor: CATALOGO },
  // O detalhe de um anúncio: é a página que se partilha e a que o Google lê.
  { padrao: /^\/(propriedades|properties)\/[^/]+$/, valor: ESTAVEL },
  // Texto que muda raramente.
  { padrao: /^\/(termos|terms|privacidade|privacy|cookies)$/, valor: ESTAVEL },
  { padrao: /^\/(planos|pricing|precos)$/, valor: ESTAVEL },
  { padrao: /^\/(sobre|about|contactos?|contact)$/, valor: ESTAVEL },
];

const LOCALES = ["pt", "en"] as const;

/** Tira o `/en` da frente, para as duas línguas caírem na mesma regra. */
function semIdioma(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/**
 * O `Cache-Control` deste caminho, ou `null` se não pode ser partilhado.
 *
 * `null` e não uma string de "não guardar": quem chama decide o que fazer com
 * a ausência, e assim não se inventa um cabeçalho onde o Next já põe o seu.
 */
export function sharedCacheControl(pathname: string): string | null {
  const caminho = semIdioma(pathname);
  return REGRAS.find(({ padrao }) => padrao.test(caminho))?.valor ?? null;
}
