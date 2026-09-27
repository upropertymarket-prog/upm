import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { Button } from "../../../../packages/ui/src/components/Button";
import { Variantes as Variantes2 } from "./Actions";
import { Tamanhos as Tamanhos2 } from "./Actions";

/**
 * Ações — Button (04 §5.4)
 * =========================================================================
 * O catálogo do design system são estes canvases, não o Storybook (07 §4.5).
 */
export default function AcoesCanvas() {
  return (
    <Canvas name="Acoes" backgroundColor="#232323">
      <Storyboard
        id="Variantes"
        name="Button · variantes e estados"
        component={Variantes2}
        layout={{ x: 0, y: 0, width: 1180, height: 560, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Tamanhos"
        name="Button · tamanhos e alvo de 40 px"
        component={Tamanhos2}
        layout={{ x: 1094, y: 0, width: 1180, height: 360, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(Button, {
  libraries: ["upm-base"],
  usageInstructions:
    "Botão de ação. `primary` para a ação principal de um ecrã, modal ou drawer (fundo --accent, hover --accent-hover); `secondary` para ações de apoio como Exportar; `ghost` para ações terciárias e barras de ferramentas; `danger` para ações destrutivas, sempre com modal de confirmação a seguir. NÃO usar para navegação — isso é um link. `iconOnly` obriga a `aria-label`; o alvo mantém-se 40 × 40 px mesmo com ícone de 15 px (07 §5.14). `type` é 'button' por omissão: passe 'submit' explicitamente dentro de um formulário.",
  variants: {
    Primario: { props: { children: "Nova propriedade" } },
    Secundario: { props: { children: "Exportar", variant: "secondary" } },
    Fantasma: { props: { children: "Cancelar", variant: "ghost" } },
    Perigo: { props: { children: "Eliminar conta", variant: "danger" } },
    Desativado: { props: { children: "Guardar", disabled: true } },
  },
});
