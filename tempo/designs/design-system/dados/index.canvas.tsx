import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { Card } from "../../../../packages/ui/src/components/Card";
import { EmptyState } from "../../../../packages/ui/src/components/EmptyState";
import { Table } from "../../../../packages/ui/src/components/Table";
import { Badge, StatusTag } from "../../../../packages/ui/src/components/StatusTag";
import { Cartoes as Cartoes2 } from "./Data";
import { Tabela as Tabela2 } from "./Data";
import { Vazio as Vazio2 } from "./Data";

export default function DadosCanvas() {
  return (
    <Canvas name="Dados" backgroundColor="#232323">
      <Storyboard
        id="Cartoes"
        name="Card, StatusTag e Badge"
        component={Cartoes2}
        layout={{ x: 0, y: 0, width: 1180, height: 560, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Tabela"
        name="Table"
        component={Tabela2}
        layout={{ x: 1628, y: 0, width: 1180, height: 520, intrinsicSizing: "root-element" }}
        vrt
      />
      <Storyboard
        id="Vazio"
        name="EmptyState"
        component={Vazio2}
        layout={{ x: 0, y: 610, width: 1180, height: 460, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(Card, {
  libraries: ["upm-base"],
  usageInstructions:
    "Superfície base de tudo o que é lista, KPI, formulário e estado vazio: --surface, borda --border, raio 16 px. Use `padded` para o caso simples e CardHeader/CardBody/CardFooter quando houver separadores. `interactive` só quando o cartão inteiro é clicável — ganha role=button e tabIndex, porque um cartão que se clica tem de se poder ativar com o teclado (04 §5.7).",
});

defineAsset(Table, {
  libraries: ["upm-base"],
  usageInstructions:
    "Tabela genérica sobre a linha, para Utilizadores, Leads, Envios e Faturas. Não pagina por dentro: recebe a página já cortada pelo servidor e leva um <Pagination> ao lado (08 §3.4). Quem rola de lado é o invólucro, nunca a página. `numeric` numa coluna alinha à direita e usa numerais tabulares — use-o em todos os preços e contagens.",
  variants: {
    Imoveis: {
      props: {
        caption: "Imóveis do portfólio",
        rows: [{ ref: "UPM-1041", preco: "485 000 €" }],
        rowKey: (row: { ref: string }) => row.ref,
        columns: [
          { id: "ref", header: "Ref.", cell: (row: { ref: string }) => row.ref },
          {
            id: "preco",
            header: "Preço",
            numeric: true,
            cell: (row: { preco: string }) => row.preco,
          },
        ],
      },
    },
  },
});

defineAsset(StatusTag, {
  libraries: ["upm-base"],
  usageInstructions:
    "Etiqueta de estado: fundo sólido, texto --on-solid, sem contorno (04 §5.6). O `tone` é um SIGNIFICADO, não uma cor — escolha visitPending, ticketAwaiting, dealSale… e a cor vem do token. Nunca laranja: laranja é a marca, não um estado. Para contadores use o Badge.",
  variants: {
    VisitaPendente: { props: { tone: "visitPending", children: "Pendente" } },
    VisitaAceite: { props: { tone: "visitAccepted", children: "Aceite" } },
    Venda: { props: { tone: "dealSale", children: "Venda" } },
    Arrendamento: { props: { tone: "dealRent", children: "Arrendamento" } },
    Rascunho: { props: { tone: "draft", children: "Rascunho" } },
  },
});

defineAsset(Badge, {
  libraries: ["upm-base"],
  usageInstructions:
    "Contador laranja de itens novos, não lidos ou pendentes — os da sidebar em Guardados, Mensagens, Meus pedidos e Contratos (07 §4.2) e os das tabs. Passe `srLabel` sempre: '3' sozinho não diz nada a um leitor de ecrã. `variant='muted'` para um zero que se quer mostrar sem chamar a atenção.",
  variants: {
    PorLer: { props: { children: "3", srLabel: "por ler" } },
    Zero: { props: { children: "0", variant: "muted" } },
  },
});

defineAsset(EmptyState, {
  libraries: ["upm-base"],
  usageInstructions:
    "Estado vazio de uma lista, grelha ou tabela. Preencha `action` sempre que houver uma saída óbvia ('Explorar propriedades') — um estado vazio sem saída é um beco. Para 'sem resultados por causa dos filtros', o texto deve dizer isso e a ação deve limpar os filtros, não mandar o utilizador para outro sítio.",
  variants: {
    SemGuardados: {
      props: {
        title: "Nenhum imóvel guardado",
        description: "Guarde os imóveis de que gostar para os encontrar aqui mais tarde.",
      },
    },
  },
});
