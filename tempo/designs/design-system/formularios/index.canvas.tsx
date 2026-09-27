import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { Checkbox } from "../../../../packages/ui/src/components/Checkbox";
import { Input, Textarea } from "../../../../packages/ui/src/components/Input";
import { Select } from "../../../../packages/ui/src/components/Select";
import { Toggle } from "../../../../packages/ui/src/components/Toggle";
import { Campos as Campos2 } from "./Forms";
import { Escolhas as Escolhas2 } from "./Forms";

/**
 * Formulários — Input, Textarea, Select, Checkbox e Toggle (04 §5.4 · 04 §5.7)
 */
export default function FormulariosCanvas() {
  return (
    <Canvas name="Formularios" backgroundColor="#232323">
      <Storyboard
        id="Campos"
        name="Input, Textarea e Select"
        component={Campos2}
        layout={{ x: 0, y: 0, width: 1180, height: 700, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Escolhas"
        name="Checkbox e Toggle"
        component={Escolhas2}
        layout={{ x: 1604, y: 0, width: 1180, height: 500, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(Input, {
  libraries: ["upm-base"],
  usageInstructions:
    "Campo de texto de uma linha. `label` é OBRIGATÓRIO (04 §5.7 exige label em todos os inputs); use `labelHidden` quando o desenho não tem espaço, nunca omita. `leadingIcon` para a lupa das pesquisas. `error` pinta a moldura a --danger, liga aria-invalid e substitui o `hint`. A moldura e o foco vivem no invólucro, não no <input>, para não haver dois anéis de foco.",
  variants: {
    Normal: { props: { label: "Título do anúncio", defaultValue: "Apartamento T3 com varanda" } },
    ComAjuda: { props: { label: "Área bruta", defaultValue: "118", hint: "Em metros quadrados." } },
    ComErro: {
      props: { label: "Preço", defaultValue: "0", error: "Indique um valor acima de 0 €." },
    },
    Desativado: { props: { label: "Referência", defaultValue: "UPM-1041", disabled: true } },
  },
});

defineAsset(Textarea, {
  libraries: ["upm-base"],
  usageInstructions:
    "Campo de texto de várias linhas, para descrições de imóvel, motivos de rejeição e mensagens. Mesmas regras do Input: `label` obrigatório, `error` e `hint` iguais. Redimensiona só na vertical.",
  variants: {
    Normal: { props: { label: "Descrição do proprietário", hint: "Máximo 2 000 caracteres." } },
  },
});

defineAsset(Select, {
  libraries: ["upm-base"],
  usageInstructions:
    "Escolha única a partir de uma lista fechada e curta (negócio, tipologia, estado). `<select>` nativo de propósito: dá o seletor do sistema em telemóvel e é acessível sem código. Para listas longas ou com pesquisa, não usar isto — precisa de um combobox, que ainda não existe no design system. `placeholder` cria a opção vazia de 'sem escolha'.",
  variants: {
    Negocio: {
      props: {
        label: "Negócio",
        placeholder: "Todos",
        options: [
          { value: "sale", label: "Venda" },
          { value: "rent", label: "Arrendamento" },
        ],
      },
    },
  },
});

defineAsset(Checkbox, {
  libraries: ["upm-base"],
  usageInstructions:
    "Caixa de seleção para consentimentos, listas de opções e seleção de linhas em tabelas. É um <input type=checkbox> real, logo participa no FormData e funciona com Server Actions. Use-o quando a escolha só conta ao Guardar; se a ação é imediata, o componente certo é o Toggle. `indeterminate` é o terceiro estado do 'selecionar todos' parcial.",
  variants: {
    Normal: { props: { label: "Aceito os termos e a política de privacidade" } },
    Indeterminado: { props: { label: "Selecionar todos", indeterminate: true } },
    Desativado: { props: { label: "Indisponível", disabled: true } },
  },
});

defineAsset(Toggle, {
  libraries: ["upm-base"],
  usageInstructions:
    "Interruptor com role=switch, para definições que se aplicam de imediato: localização aproximada, feature flags, 'Open Graph igual aos dados da página'. NÃO usar em formulários que só gravam no Guardar — aí o componente é o Checkbox. O desenho tem 44 × 24 px mas o invólucro garante o alvo de 40 px (07 §5.14).",
  variants: {
    Ligado: {
      props: {
        checked: true,
        label: "Mostrar só a localização aproximada",
        onCheckedChange: () => undefined,
      },
    },
    Desligado: {
      props: { checked: false, label: "Destacar no Market", onCheckedChange: () => undefined },
    },
  },
});
