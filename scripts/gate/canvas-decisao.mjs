/**
 * A decisão do `gate:canvas`, sem efeitos — para se poder testar
 * ===========================================================================
 * O `check-canvas.mjs` corre o `tsc` do sidecar e sai; não se importa sem o
 * correr. A parte que decide fica aqui, pura, e `check-canvas.test.mjs`
 * prova-a com saídas de `tsc` escritas à mão — incluindo a que o CI produz.
 *
 * ## O host gerado, e o único erro que se perdoa por ele faltar
 *
 * `main.tsx` e `app/tempo-host/page.tsx` importam `.tempo/tempo-host`, que o
 * Tempo gera na máquina de quem tem a app aberta e que o `.gitignore` deixa de
 * fora. No CI não existe, e o `tsc` dizia "Cannot find module" sobre ele —
 * desde 27 out o `main` estava vermelho por isto, sem nenhuma storyboard
 * partida. Perdoa-se **esse** erro (TS2307 sobre esse módulo) e **só** quando
 * o ficheiro falta mesmo; qualquer outro erro, inclusive noutro módulo em
 * falta, continua a parar o portão. Onde o host existe, nada muda.
 *
 * ## "Não arrancou" mede-se antes do perdão
 *
 * A primeira versão deste perdão (1 nov) filtrava os erros e só depois
 * perguntava "saiu com erro sem dizer nada sobre tipos?". Com os dois erros
 * perdoados, a resposta era sim — o `tsc` sai com 2 mesmo quando tudo o que
 * disse foi perdoado — e o portão acusava o `tsc` de não ter arrancado. A
 * pergunta "arrancou?" é sobre o que o `tsc` disse, não sobre o que sobrou.
 */

export const doHostGerado = (linha) =>
  linha.includes("error TS2307") && /'(?:\.\.?\/)+\.tempo\/tempo-host'/.test(linha);

/**
 * @param {string} saida   stdout + stderr do `tsc`
 * @param {number|null} status código de saída do `tsc`
 * @param {boolean} hostGerado se `tempo/.tempo/tempo-host.*` existe
 * @returns {{ naoArrancou: boolean, erros: string[], perdoados: number }}
 */
export function decidir(saida, status, hostGerado) {
  const brutos = saida.split("\n").filter((linha) => linha.includes("error TS"));
  const erros = brutos.filter((linha) => hostGerado || !doHostGerado(linha));
  return {
    naoArrancou: brutos.length === 0 && status !== 0,
    erros,
    perdoados: brutos.length - erros.length,
  };
}
