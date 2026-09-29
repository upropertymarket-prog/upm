import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Painel, { PainelEscuro } from "./Painel";

/**
 * Canvas do Proprietário — Fase 4.
 *
 * Só o Painel. As storyboards de Market, Mapa, As minhas propriedades, Nova
 * propriedade e Detalhe foram removidas em favor de as reconstruir a partir de
 * componentes reais da app; o registo do que existia está no doc "Registo —
 * storyboards do Proprietário removidas (Fase 4)" e o código em `174b63f`.
 *
 * Sem `intrinsicSizing`: o enquadramento é um viewport de monitor (1440 × 900)
 * e o conteúdo rola lá dentro, como num ecrã verdadeiro.
 *
 * O mesmo ecrã aparece duas vezes, lado a lado e alinhados, com 80 px entre
 * eles: claro e escuro. 04 §5.2 trata o modo escuro como requisito, não como
 * variante opcional — vê-los juntos é o que apanha um contraste mau antes de
 * chegar ao código.
 */
export default function ProprietarioCanvas() {
  return (
    <Canvas name="Proprietario" backgroundColor="#232323">
      <Storyboard
        id="Painel"
        name="Painel · Claro (/painel)"
        component={Painel}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PainelEscuro"
        name="Painel · Escuro (/painel)"
        component={PainelEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
