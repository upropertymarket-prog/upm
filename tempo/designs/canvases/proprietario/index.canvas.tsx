import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Painel from "./Painel";

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
 */
export default function ProprietarioCanvas() {
  return (
    <Canvas name="Proprietario" backgroundColor="#232323">
      <Storyboard
        id="Painel"
        name="Painel (/painel)"
        component={Painel}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="Painel1920"
        name="Painel · 1920 (limite de largura)"
        component={Painel}
        layout={{ x: 1540, y: 0, width: 1920, height: 1080 }}
      />
    </Canvas>
  );
}
