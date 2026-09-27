import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { Drawer, Modal } from "../../../../packages/ui/src/components/Overlay";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { ModalEDrawer as ModalEDrawer2 } from "./Overlays";
import { Toasts as Toasts2 } from "./Overlays";

export default function SobreposicoesCanvas() {
  return (
    <Canvas name="Sobreposicoes" backgroundColor="#232323">
      <Storyboard
        id="ModalEDrawer"
        name="Modal e Drawer · abrir para ver"
        component={ModalEDrawer2}
        layout={{ x: 0, y: 0, width: 1180, height: 420, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Toasts"
        name="Toast"
        component={Toasts2}
        layout={{ x: 1101, y: 0, width: 1180, height: 360, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(Modal, {
  libraries: ["upm-base"],
  usageInstructions:
    "Diálogo ao centro, para tarefas curtas e decisões (04 §5.4): confirmar, rejeitar com motivo, partilhar, criar/editar plano, pedir visita, reportar problema, novidades no login. Se o conteúdo é um registo vindo de uma lista, o componente certo é o Drawer. Tamanhos sm 460 / md 520 / lg 640. Fecha por Esc, véu e X; tem focus trap e devolve o foco à origem.",
  variants: {
    PedirVisita: {
      props: {
        open: true,
        onClose: () => undefined,
        title: "Pedir visita",
        subtitle: "O proprietário recebe uma notificação e responde na Agenda de visitas.",
        children: "Data, hora e mensagem.",
      },
    },
  },
});

defineAsset(Drawer, {
  libraries: ["upm-base"],
  usageInstructions:
    "Painel lateral à direita, 460 px, altura total (04 §5.4). Serve exatamente um caso: ver ou editar um registo vindo de uma lista — leads, utilizadores, tickets, visitas, imóveis em moderação. Para uma decisão curta use o Modal; para o composer de e-mail, a janela do canto inferior direito. Mesmo comportamento de teclado e foco do Modal.",
  variants: {
    DetalheDeImovel: {
      props: {
        open: true,
        onClose: () => undefined,
        title: "Apartamento T3 com varanda",
        subtitle: "UPM-1041 · Lisboa · Campo de Ourique",
        children: "Preço, negócio e notas de moderação.",
      },
    },
  },
});

defineAsset(ToastProvider, {
  libraries: ["upm-base"],
  usageInstructions:
    "Envolve a app inteira, uma vez, no root layout; os ecrãs chamam `useToast()` e emitem `toast(texto, tom)`. Tons: success, info, error. A região é aria-live=polite, como 04 §5.7 exige. Um toast CONFIRMA uma ação que o utilizador acabou de fazer — um erro que exige decisão é um Modal, não um toast. Dura 2,4 s.",
  variants: {
    Padrao: { props: { children: "A app inteira" } },
  },
});
