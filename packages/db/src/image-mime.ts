/**
 * O tipo de uma imagem, decidido pelos bytes (12 §5.4 · 07 §19.8 #2)
 * ===========================================================================
 * `File.type`, num `FormData`, é escrito pelo browser a partir da extensão do
 * nome — e quem publica o pedido à mão escreve o que quiser. Validar por ele é
 * validar a palavra de quem carrega o ficheiro, que é exatamente a pessoa de
 * quem não se depende.
 *
 * Esta função existia **duas vezes**, copiada em
 * `marketing/atualizacoes/actions.ts` e `marketing/campanhas/actions.ts`, e já
 * tinha começado a divergir: uma reconhecia GIF e a outra não. Uma regra de
 * validação em dois sítios diverge, e a que diverge é a que fica aberta — por
 * isso vive aqui, numa só.
 *
 * ## Deteta tudo; quem chama é que decide o que aceita
 *
 * Os três consumidores querem listas diferentes — as fotografias de imóveis
 * não querem GIF, as campanhas querem. Uma função que só soubesse o
 * denominador comum obrigava cada um a reimplementar o resto, que é como a
 * duplicação começou da primeira vez.
 *
 * ## O que isto garante, e o que não garante
 *
 * Garante que os primeiros bytes são os de uma imagem conhecida. **Não**
 * garante que o ficheiro inteiro seja uma imagem válida, nem que um
 * descodificador o aceite sem se queixar — para isso era preciso descodificá-lo,
 * e isso é outra conversa, com outro custo.
 *
 * O que fecha é o caso que interessa: ninguém põe um executável, um HTML ou um
 * ficheiro arbitrário num bucket nosso com nome de fotografia.
 */

export type ImageKind = {
  /** O MIME a gravar no Storage — o detetado, nunca o declarado. */
  type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** A extensão a usar no caminho, para o nome não contradizer o conteúdo. */
  extension: "png" | "jpg" | "webp" | "gif";
};

const comeca = (bytes: Uint8Array, assinatura: readonly number[]) =>
  assinatura.every((byte, at) => bytes[at] === byte);

/** `null` quando os bytes não são de nenhuma imagem que conheçamos. */
export function sniffImageMime(bytes: Uint8Array): ImageKind | null {
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { type: "image/png", extension: "png" };
  }
  if (comeca(bytes, [0xff, 0xd8, 0xff])) {
    return { type: "image/jpeg", extension: "jpg" };
  }
  if (comeca(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return { type: "image/gif", extension: "gif" };
  }
  // WebP é RIFF com o tipo no 9.º byte, e por isso não cabe na mesma forma.
  if (
    comeca(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    [0x57, 0x45, 0x42, 0x50].every((byte, at) => bytes[8 + at] === byte)
  ) {
    return { type: "image/webp", extension: "webp" };
  }
  return null;
}

/**
 * O mesmo, já limitado ao que este sítio aceita.
 *
 * Devolve `null` tanto para "não é imagem" como para "é imagem, mas não desta
 * lista" — quem chama dá a mesma resposta nos dois casos, e dizer qual dos
 * dois foi não ajuda ninguém a não ser quem está a sondar.
 */
export function sniffImageMimeAllowed(
  bytes: Uint8Array,
  permitidos: ReadonlyArray<ImageKind["type"]>,
): ImageKind | null {
  const kind = sniffImageMime(bytes);
  return kind && permitidos.includes(kind.type) ? kind : null;
}
