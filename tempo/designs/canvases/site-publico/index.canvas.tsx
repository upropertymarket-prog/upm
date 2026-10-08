import { Canvas, Storyboard } from "tempo-sdk/canvas";

import {
  PosLancamentoClaro,
  PosLancamentoEscuro,
  PreInscricaoClaro,
  PreLancamentoClaro,
  PreLancamentoEscuro,
} from "./Ecrans";

/**
 * Site público — pré e pós-lançamento, nos dois temas (P2-01 · P2-02 · P2-03).
 *
 * **Molduras fixas de 1440 × 900, e a página rola dentro delas** — como rola
 * num browser. É a mesma medida de todos os outros canvases do projeto, e o que
 * se revê numa storyboard é o enquadramento: o hero, as larguras, o ritmo das
 * secções, a tipografia nos dois temas.
 *
 * Esta é a terceira tentativa de dimensionamento, e as duas primeiras já
 * estavam documentadas no canvas `legal` — foram repetidas aqui por não se ter
 * lido esse ficheiro antes de criar este. Fica o registo outra vez, agora dos
 * dois lados:
 *
 * 1. `intrinsicSizing: "root-element"` com `height: 900` — o guia reserva-o
 *    para storyboards de **componente**, não de página: a moldura passa a
 *    medir-se pelo conteúdo, e estas páginas têm largura máxima e centram-se.
 *    A largura colapsou de 1440 para **493 px** e as margens reais da página
 *    desapareceram. Pior: a altura real do conteúdo é de ~1990 px, muito acima
 *    do espaçamento de 950 px em y, e **cada moldura transbordava para cima da
 *    seguinte**. O sintoma no canvas é enganador — lê-se como secções
 *    duplicadas e texto sobreposto, quando o código não tem duplicação
 *    nenhuma. Foi o que escapou na sessão anterior por se ter olhado para
 *    capturas de storyboards isoladas, que nunca mostram a vizinha.
 * 2. Altura medida página a página — corrige a largura, mas dá molduras
 *    gigantescas, impossíveis de comparar lado a lado, e obriga a reafinar a
 *    altura a cada alteração de texto.
 *
 * Daí a regra: **sem `intrinsicSizing`**, 1440 × 900, pares claro/escuro com
 * 80 px entre si e 980 px entre linhas (900 de moldura + 80 de goteira), que é
 * exatamente o passo do canvas `legal`.
 */
export default function SitePublicoCanvas() {
  return (
    <Canvas name="site-publico" backgroundColor="#232323">
      <Storyboard
        id="PreLancamentoClaro"
        name="Home · Pré-lançamento · claro (/)"
        component={PreLancamentoClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PreLancamentoEscuro"
        name="Home · Pré-lançamento · escuro (/)"
        component={PreLancamentoEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />

      <Storyboard
        id="PosLancamentoClaro"
        name="Home · Pós-lançamento · claro (/)"
        component={PosLancamentoClaro}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PosLancamentoEscuro"
        name="Home · Pós-lançamento · escuro (/)"
        component={PosLancamentoEscuro}
        layout={{ x: 1520, y: 980, width: 1440, height: 900 }}
      />

      <Storyboard
        id="PreInscricaoClaro"
        name="Pré-inscrição · claro (/pre-inscricao)"
        component={PreInscricaoClaro}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
