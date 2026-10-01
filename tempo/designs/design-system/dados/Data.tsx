"use client";

/**
 * Narração de canvas — Card, Table, StatusTag, Badge e EmptyState
 * =========================================================================
 * Dados fixos, tirados do `seed.sql` dos protótipos (02 §14): Ana Silva,
 * UPM-1041…1049. Fixturas reais deixam o canvas parecer o produto.
 */
import { Bookmark } from "lucide-react";

import { Button } from "../../../../packages/ui/src/components/Button";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../packages/ui/src/components/Card";
import { EmptyState } from "../../../../packages/ui/src/components/EmptyState";
import { Table } from "../../../../packages/ui/src/components/Table";
import { Badge, StatusTag } from "../../../../packages/ui/src/components/StatusTag";
import { Note, Row, ThemePair } from "../../_narration/ThemePair";

type Imovel = {
  ref: string;
  titulo: string;
  localidade: string;
  preco: string;
  estado: "active" | "pending" | "draft";
};

const IMOVEIS: Imovel[] = [
  {
    ref: "UPM-1041",
    titulo: "Apartamento T3 com varanda",
    localidade: "Lisboa · Campo de Ourique",
    preco: "485 000 €",
    estado: "active",
  },
  {
    ref: "UPM-1042",
    titulo: "Moradia T4 com jardim",
    localidade: "Cascais · Birre",
    preco: "1 250 000 €",
    estado: "active",
  },
  {
    ref: "UPM-1047",
    titulo: "Apartamento T4 vista rio",
    localidade: "Porto · Foz do Douro",
    preco: "890 000 €",
    estado: "pending",
  },
  {
    ref: "UPM-1049",
    titulo: "Apartamento T1 no centro",
    localidade: "Faro · Sé",
    preco: "720 €/mês",
    estado: "draft",
  },
];

const ESTADO_TAG = {
  active: { tone: "active" as const, label: "Ativo" },
  pending: { tone: "pending" as const, label: "Em moderação" },
  draft: { tone: "draft" as const, label: "Rascunho" },
};

/** Card com cabeçalho, corpo e rodapé; tags de estado e contadores. */
export function Cartoes() {
  return (
    <ThemePair>
      <Row label="Card com cabeçalho, corpo e rodapé">
        <div style={{ width: 420 }}>
          <Card>
            <CardHeader>
              <CardTitle>Apartamento T3 com varanda</CardTitle>
              <StatusTag tone="dealSale">Venda</StatusTag>
            </CardHeader>
            <CardBody>
              <span style={{ color: "var(--muted)" }}>
                Lisboa · Campo de Ourique · T3 · 118 m² · 2 WC
              </span>
              <strong style={{ fontSize: "var(--fs-subtitle-lg)" }}>485 000 €</strong>
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="secondary">
                Ver detalhes
              </Button>
              <Button size="sm">Pedir visita</Button>
            </CardFooter>
          </Card>
        </div>
        <div style={{ width: 300 }}>
          <Card padded>
            <span
              style={{
                fontSize: "var(--fs-label)",
                fontWeight: "var(--fw-black)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Visualizações dos imóveis
            </span>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-title)" }}>
              9 420
            </strong>
          </Card>
        </div>
      </Row>
      <Row label="Tags de estado · 12 px / peso 550 · fundo sólido, texto --on-solid (04 §5.6)">
        <StatusTag tone="visitPending">Pendente</StatusTag>
        <StatusTag tone="visitAccepted">Aceite</StatusTag>
        <StatusTag tone="visitRescheduled">Reagendada</StatusTag>
        <StatusTag tone="visitCancelled">Cancelada</StatusTag>
        <StatusTag tone="visitArchived">Arquivada</StatusTag>
      </Row>
      <Row label="Badge · contadores de navegação e de tabs (07 §4.2)">
        <Badge srLabel="por ler">3</Badge>
        <Badge srLabel="por ler">12</Badge>
        <Badge variant="muted">0</Badge>
      </Row>
      <Note>
        O Badge é laranja `--accent` porque é o contador de Guardados, Mensagens, Meus pedidos e
        Contratos (07 §4.2). A StatusTag nunca é laranja: laranja é a marca, não um estado.
      </Note>
    </ThemePair>
  );
}

/** Table com cabeçalho sticky, coluna numérica e linha selecionada. */
export function Tabela() {
  return (
    <ThemePair>
      <Table
        caption="Imóveis do portfólio"
        rows={IMOVEIS}
        rowKey={(row) => row.ref}
        selectedKey="UPM-1042"
        onRowClick={() => undefined}
        columns={[
          {
            id: "ref",
            header: "Ref.",
            width: "120px",
            cell: (row) => <span style={{ fontFamily: "var(--font-mono)" }}>{row.ref}</span>,
          },
          { id: "titulo", header: "Imóvel", cell: (row) => row.titulo },
          { id: "localidade", header: "Localidade", cell: (row) => row.localidade },
          { id: "preco", header: "Preço", numeric: true, cell: (row) => row.preco },
          {
            id: "estado",
            header: "Estado",
            cell: (row) => (
              <StatusTag tone={ESTADO_TAG[row.estado].tone}>
                {ESTADO_TAG[row.estado].label}
              </StatusTag>
            ),
          },
        ]}
      />
      <Note>
        Quem rola de lado é o invólucro da tabela, nunca a página: 02 §13 pede 360 px a 1920 px. Os
        preços usam numerais tabulares e alinham à direita, para as casas decimais ficarem umas por
        cima das outras.
      </Note>
    </ThemePair>
  );
}

/** EmptyState com ação, e o vazio dentro de uma tabela. */
export function Vazio() {
  return (
    <ThemePair>
      <EmptyState
        icon={<Bookmark size={40} />}
        title="Nenhum imóvel guardado"
        description="Guarde os imóveis de que gostar para os encontrar aqui mais tarde."
        action={<Button>Explorar propriedades</Button>}
      />
      <Note>
        Um estado vazio sem saída é um beco: sempre que houver uma ação óbvia que tire o utilizador
        dali, ela entra em `action`.
      </Note>
    </ThemePair>
  );
}
