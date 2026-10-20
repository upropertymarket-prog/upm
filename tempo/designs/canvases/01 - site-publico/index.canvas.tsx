import { Canvas, Storyboard } from "tempo-sdk/canvas";

import {
  FichaClaro,
  FichaEscuro,
  ImoveisClaro,
  ImoveisEscuro,
  ImoveisPreLancamentoClaro,
  ImoveisPreLancamentoEscuro,
  ImoveisSemResultados,
  ImoveisSemResultadosEscuro,
  PosLancamentoClaro,
  PosLancamentoEscuro,
  PreInscricaoClaro,
  PreInscricaoEscuro,
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
 * exatamente o passo do canvas `legal`. Sem exceções: todas as molduras deste
 * canvas são páginas inteiras, e nenhuma linha foge ao passo.
 *
 * O Market público (`/propriedades`) e o detalhe entraram a 12 out 2026, com P2-05.
 * "Sem propriedades" tem storyboard própria porque é o estado que um visitante
 * encontra ao filtrar por uma localidade sem anúncios — acontece desde o
 * primeiro dia e é o mais fácil de deixar feio.
 *
 * **A ordem das linhas é a do visitante, não a de quem escreveu o código.** De
 * cima para baixo: home em pré-lançamento → home em pós-lançamento →
 * pré-inscrição → Market em pré-lançamento → Market sem propriedades → Market
 * com propriedades → detalhe de propriedade. É a vida do site do dia zero ao
 * catálogo cheio, e dentro do Market é do estado mais vazio para o mais cheio.
 * Quem percorre o canvas de cima a baixo vê o produto a encher-se; a ordem
 * anterior punha o catálogo cheio primeiro e o ecrã de pré-lançamento — o
 * único que hoje existe a sério — enterrado no fim.
 *
 * Revisto a 12 out 2026, e o que faltava era de três tipos:
 *
 *  - **Pares de tema incompletos.** `/pre-inscricao` e o Market sem resultados
 *    só tinham a storyboard clara. Uma página pública que só se revê num tema
 *    é uma página cujo tema escuro ninguém olhou — e o `ThemeToggle` está na
 *    navbar de todas elas, por isso o visitante escolhe.
 *  - **Storyboard sem a navbar da página.** `/pre-inscricao` mostrava só o
 *    formulário e os cartões; a `page.tsx` tem `PublicHeader` e `SiteFooter`.
 *    A regra para páginas é reproduzir a moldura da rota — foi o que se fez em
 *    `/propriedades` e não se tinha feito aqui.
 *  - **Um ramo de rota inteiro sem storyboard.** `/propriedades` em `pre` devolve
 *    uma página diferente — "em breve" + CTA para a pré-inscrição —, que é o
 *    que **todos** os visitantes vão ver até ao lançamento. Era o ecrã mais
 *    visto do site e não existia no canvas.
 *
 * **Uma storyboard por rota, nunca por secção.** A 13 out 2026 saíram as duas
 * molduras de "Propriedades mais recentes": a secção já é renderizada dentro das
 * storyboards de `/` em pós-lançamento, e uma moldura só para ela era uma
 * segunda entrada para o mesmo componente — mais uma coisa a manter alinhada a
 * cada alteração, sem ecrã novo nenhum. O preço é conhecido e aceite: a secção
 * fica abaixo da dobra dos 900 px, por isso vê-se rolando `PosLancamento`, e
 * não há captura isolada dela.
 */
export default function SitePublicoCanvas() {
  return (
    <Canvas name="01 - site-publico" backgroundColor="#232323">
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
      <Storyboard
        id="PreInscricaoEscuro"
        name="Pré-inscrição · escuro (/pre-inscricao)"
        component={PreInscricaoEscuro}
        layout={{ x: 1520, y: 1960, width: 1440, height: 900 }}
      />

      {/* O ramo `pre` da mesma rota, e por isso **antes** dos outros dois: é o
          que o visitante vê até ao lançamento. */}
      <Storyboard
        id="ImoveisPreLancamentoClaro"
        name="Market público · pré-lançamento · claro (/propriedades)"
        component={ImoveisPreLancamentoClaro}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ImoveisPreLancamentoEscuro"
        name="Market público · pré-lançamento · escuro (/propriedades)"
        component={ImoveisPreLancamentoEscuro}
        layout={{ x: 1520, y: 2940, width: 1440, height: 900 }}
      />

      <Storyboard
        id="ImoveisSemResultados"
        name="Market público · sem propriedades · claro (/propriedades?cidade=Guarda)"
        component={ImoveisSemResultados}
        layout={{ x: 0, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ImoveisSemResultadosEscuro"
        name="Market público · sem propriedades · escuro (/propriedades?cidade=Guarda)"
        component={ImoveisSemResultadosEscuro}
        layout={{ x: 1520, y: 3920, width: 1440, height: 900 }}
      />

      <Storyboard
        id="ImoveisClaro"
        name="Market público · com propriedades · claro (/propriedades)"
        component={ImoveisClaro}
        layout={{ x: 0, y: 4900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="ImoveisEscuro"
        name="Market público · com propriedades · escuro (/propriedades)"
        component={ImoveisEscuro}
        layout={{ x: 1520, y: 4900, width: 1440, height: 900 }}
      />

      <Storyboard
        id="FichaClaro"
        name="Detalhe de propriedade · claro (/propriedades/[slug])"
        component={FichaClaro}
        layout={{ x: 0, y: 5880, width: 1440, height: 900 }}
      />
      <Storyboard
        id="FichaEscuro"
        name="Detalhe de propriedade · escuro (/propriedades/[slug])"
        component={FichaEscuro}
        layout={{ x: 1520, y: 5880, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
