import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { Pagination } from "../../../../packages/ui/src/components/Pagination";
import { Tabs } from "../../../../packages/ui/src/components/Tabs";
import { Separadores as Separadores2 } from "./Navigation";
import { Paginacao as Paginacao2 } from "./Navigation";

export default function NavegacaoCanvas() {
  return (
    <Canvas name="Navegacao" backgroundColor="#232323">
      <Storyboard
        id="Separadores"
        name="Tabs · com contadores de estado"
        component={Separadores2}
        layout={{ x: 0, y: 0, width: 1180, height: 420, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Paginacao"
        name="Pagination"
        component={Paginacao2}
        layout={{ x: 1112, y: 0, width: 1180, height: 420, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(Tabs, {
  libraries: ["upm-base"],
  usageInstructions:
    "Separadores de filtro dentro de um ecrã: tabs de estado do Suporte, filtros por negócio em As minhas propriedades, intervalos 7/30/12 meses nos gráficos. NÃO usar para navegar entre páginas — isso é a sidebar. `countTone` tinge o contador com a cor do estado que a tab representa (04 §5.6). Não renderiza painéis: as vistas do produto trocam conteúdo por rota ou por estado, não por painel escondido.",
  variants: {
    EstadosDeTicket: {
      props: {
        label: "Estado do ticket",
        value: "new",
        onValueChange: () => undefined,
        items: [
          { id: "new", label: "Por tratar", count: 7, countTone: "ticketNew" },
          { id: "progress", label: "Em curso", count: 3, countTone: "ticketProgress" },
          { id: "awaiting", label: "Por confirmar", count: 2, countTone: "ticketAwaiting" },
          { id: "closed", label: "Fechados", count: 41, countTone: "ticketClosed" },
        ],
      },
    },
  },
});

defineAsset(Pagination, {
  libraries: ["upm-base"],
  usageInstructions:
    "Controlo de paginação. 08 §3.4 torna a paginação OBRIGATÓRIA em toda a listagem, logo toda a tabela e toda a grelha de cartões leva um destes. É só o controlo: o corte dos dados é do servidor (keyset nas listas grandes). `summary` recebe o texto já traduzido ('1–20 de 397'); `labels` recebe as traduções dos botões.",
  variants: {
    Inicio: { props: { page: 1, pageCount: 20, onPageChange: () => undefined } },
    AMeio: {
      props: { page: 10, pageCount: 20, onPageChange: () => undefined, summary: "181–200 de 397" },
    },
  },
});
