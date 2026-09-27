import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { Cores as Cores2 } from "./Foundations";
import { Estado as Estado2 } from "./Foundations";
import { Tipografia as Tipografia2 } from "./Foundations";
import { Geometria as Geometria2 } from "./Foundations";

/**
 * Fundações — tokens do design system (04 §5.1 · 04 §5.6 · 07 §3 · 07 §5.14)
 * =========================================================================
 * Página de fundações: não tem componente para declarar, logo é o único caso em
 * que o canvas se auto-registra como asset (regra das zonas estritas).
 *
 * A fonte única é `packages/ui/src/styles/tokens.css`. Estes storyboards leem as
 * variables através de `var(--…)`, portanto não podem divergir dos tokens.
 */
export default function FundacoesCanvas() {
  return (
    <Canvas name="Fundacoes" backgroundColor="#232323">
      <Storyboard
        id="Cores"
        name="Cores · claro e escuro"
        component={Cores2}
        layout={{ x: -835, y: -913, width: 1371, height: 1295, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Estado"
        name="Cores de estado"
        component={Estado2}
        layout={{ x: 0, y: 279, width: 1180, height: 420, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Tipografia"
        name="Tipografia"
        component={Tipografia2}
        layout={{ x: 1715, y: 895, width: 900, height: 720, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Geometria"
        name="Geometria e alvos"
        component={Geometria2}
        layout={{ x: 0, y: 1580, width: 900, height: 560, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(FundacoesCanvas, {
  libraries: ["upm-fundacoes"],
  usageInstructions:
    "Inventário canónico dos tokens da UProperty Market: paleta clara/escura de 04 §5.1, cores de estado de 04 §5.6, escala tipográfica de 07 §3 e geometria com o alvo de 40 px de 07 §5.14. Consultar ANTES de escrever qualquer cor, tamanho de letra ou raio. Regra que não se negoceia: nenhum componente escreve uma cor literal — tudo sai de packages/ui/src/styles/tokens.css. Não declara componente porque é uma página de fundações.",
});
