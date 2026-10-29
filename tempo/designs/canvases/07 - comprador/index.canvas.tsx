import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { CompradorPainelClaro, CompradorPainelEscuro } from "./Painel";
import {
  CompradorAlertasClaro,
  CompradorAlertasEscuro,
  CompradorGuardadosClaro,
  CompradorGuardadosEscuro,
  CompradorGuardadosVazio,
  CompradorGuardadosVazioEscuro,
} from "./Guardados";
import {
  CompradorPedidosClaro,
  CompradorPedidosEscuro,
  CompradorPedidosVazio,
  CompradorPedidosVazioEscuro,
} from "./Pedidos";

/**
 * Canvas do Comprador — o que é só dele.
 *
 * O comprador e o proprietário vivem os dois na `apps/app` e partilham a maior
 * parte dos ecrãs: Market, Mensagens, Mapa, Cloud, Contratos, Reports, Plano e
 * Definições são as mesmas rotas, com a navegação a mudar pelo `role`. Esses
 * já estão desenhados no canvas 06 e ficam para uma segunda passagem, montados
 * com `role="buyer"`.
 *
 * Este canvas tem os quatro que **não existem em mais lado nenhum**: o Painel
 * do comprador (`BuyerDashboard`, que nunca tinha ido a storyboard), os
 * Guardados, os Alertas de pesquisa e os Meus pedidos.
 *
 * ## A mesma história, do outro lado
 *
 * O comprador é o João Costa, o interessado que já existe nas fixtures do
 * canvas 06. As visitas são as mesmas, invertidas: lá a Ana Silva recebe os
 * pedidos, aqui é ele a vê-los do seu lado. Percorrer os dois canvases é ver o
 * mesmo negócio das duas pontas — ver `demo.ts`.
 *
 * Sem `intrinsicSizing`: o enquadramento é um viewport de monitor (1440 × 900)
 * e o conteúdo rola lá dentro, como num ecrã verdadeiro.
 *
 * **Arrumação: duas colunas.** À esquerda (`x: 0`) o modo claro, à direita
 * (`x: 1520`) o escuro — 80 px entre colunas e entre linhas. 04 §5.2 trata o
 * modo escuro como requisito, não como variante opcional.
 *
 * **As linhas seguem a ordem da sidebar** de 07 §4.2, para percorrer o canvas
 * de cima a baixo ser percorrer o menu de cima a baixo: Painel, Guardados
 * (com os Alertas logo a seguir, que é a sub-rota que o ecrã oferece) e Meus
 * pedidos.
 *
 * Os estados vazios têm moldura própria em vez de ficarem por contar: nos
 * Guardados e nos Meus pedidos são o primeiro ecrã que qualquer conta nova vê,
 * e é neles que se decide se a app explica o que fazer a seguir ou se parece
 * uma lista que falhou a carregar.
 */
export default function CompradorCanvas() {
  return (
    <Canvas name="07 - comprador" backgroundColor="#232323">
      <Storyboard
        id="CompradorPainelClaro"
        name="Painel · Claro (/painel)"
        component={CompradorPainelClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompradorPainelEscuro"
        name="Painel · Escuro (/painel)"
        component={CompradorPainelEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CompradorGuardadosClaro"
        name="Guardados · Claro (/guardados)"
        component={CompradorGuardadosClaro}
        layout={{ x: 0, y: 980, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompradorGuardadosEscuro"
        name="Guardados · Escuro (/guardados)"
        component={CompradorGuardadosEscuro}
        layout={{ x: 1520, y: 980, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CompradorGuardadosVazio"
        name="Guardados · Sem imóveis · Claro"
        component={CompradorGuardadosVazio}
        layout={{ x: 0, y: 1960, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompradorGuardadosVazioEscuro"
        name="Guardados · Sem imóveis · Escuro"
        component={CompradorGuardadosVazioEscuro}
        layout={{ x: 1520, y: 1960, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CompradorAlertasClaro"
        name="Alertas de pesquisa · Claro (/guardados/alertas)"
        component={CompradorAlertasClaro}
        layout={{ x: 0, y: 2940, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompradorAlertasEscuro"
        name="Alertas de pesquisa · Escuro (/guardados/alertas)"
        component={CompradorAlertasEscuro}
        layout={{ x: 1520, y: 2940, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CompradorPedidosClaro"
        name="Meus pedidos · Claro (/meus-pedidos)"
        component={CompradorPedidosClaro}
        layout={{ x: 0, y: 3920, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompradorPedidosEscuro"
        name="Meus pedidos · Escuro (/meus-pedidos)"
        component={CompradorPedidosEscuro}
        layout={{ x: 1520, y: 3920, width: 1440, height: 900 }}
      />

      <Storyboard
        id="CompradorPedidosVazio"
        name="Meus pedidos · Sem pedidos · Claro"
        component={CompradorPedidosVazio}
        layout={{ x: 0, y: 4900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompradorPedidosVazioEscuro"
        name="Meus pedidos · Sem pedidos · Escuro"
        component={CompradorPedidosVazioEscuro}
        layout={{ x: 1520, y: 4900, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
