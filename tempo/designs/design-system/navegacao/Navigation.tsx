"use client";

/**
 * Narração de canvas — Tabs e Pagination (04 §5.6 · 04 §5.7 · 08 §3.4)
 */
import { useState } from "react";

import { Pagination } from "../../../../packages/ui/src/components/Pagination";
import { Tabs } from "../../../../packages/ui/src/components/Tabs";
import { Note, Row, ThemePair } from "../../_narration/ThemePair";

function SeparadoresDemo() {
  const [suporte, setSuporte] = useState("new");
  const [imoveis, setImoveis] = useState("all");

  return (
    <>
      <Row label="Tabs do Suporte · contador com a cor do estado (04 §5.6)">
        <Tabs
          label="Estado do ticket"
          value={suporte}
          onValueChange={setSuporte}
          items={[
            { id: "new", label: "Por tratar", count: 7, countTone: "ticketNew" },
            { id: "progress", label: "Em curso", count: 3, countTone: "ticketProgress" },
            { id: "awaiting", label: "Por confirmar", count: 2, countTone: "ticketAwaiting" },
            { id: "closed", label: "Fechados", count: 41, countTone: "ticketClosed" },
          ]}
        />
      </Row>
      <Row label="Filtros de As minhas propriedades · um deles desativado">
        <Tabs
          label="Negócio"
          value={imoveis}
          onValueChange={setImoveis}
          items={[
            { id: "all", label: "Todos", count: 12 },
            { id: "sale", label: "À venda", count: 7, countTone: "dealSale" },
            { id: "rent", label: "Para arrendar", count: 5, countTone: "dealRent" },
            { id: "draft", label: "Rascunhos", count: 0, countTone: "draft", disabled: true },
          ]}
        />
      </Row>
      <Note>
        Navegação por setas, `Home` e `End`, com roving tabindex: só a tab ativa entra na ordem do
        Tab e as setas movem entre tabs — o padrão ARIA que 04 §5.7 exige. Experimente com o teclado
        no storyboard.
      </Note>
    </>
  );
}

/** Tabs nos dois temas, com contadores tingidos pelo estado. */
export function Separadores() {
  return (
    <ThemePair>
      <SeparadoresDemo />
    </ThemePair>
  );
}

function PaginacaoDemo() {
  const [inicio, setInicio] = useState(1);
  const [meio, setMeio] = useState(10);
  const [fim, setFim] = useState(20);

  return (
    <>
      <Row label="Primeira página · Anterior desativado">
        <Pagination page={inicio} pageCount={20} onPageChange={setInicio} summary="1–20 de 397" />
      </Row>
      <Row label="A meio · elipses dos dois lados">
        <Pagination page={meio} pageCount={20} onPageChange={setMeio} summary="181–200 de 397" />
      </Row>
      <Row label="Última página · Seguinte desativado">
        <Pagination page={fim} pageCount={20} onPageChange={setFim} summary="381–397 de 397" />
      </Row>
      <Note>
        O componente é só o controlo: quem corta os dados é o servidor, com keyset nas listas
        grandes (08 §3.4). Um salto de uma única página mostra-se como número — uma elipse no lugar
        de um número é mais larga e diz menos.
      </Note>
    </>
  );
}

/** Pagination nos três extremos: início, meio e fim. */
export function Paginacao() {
  return (
    <ThemePair>
      <PaginacaoDemo />
    </ThemePair>
  );
}
