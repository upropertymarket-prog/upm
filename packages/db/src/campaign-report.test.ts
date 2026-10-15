import { describe, expect, it } from "vitest";

import {
  campaignReportCsv,
  deliveredOf,
  rate,
  type CampaignReportLabels,
  type CampaignReportRow,
} from "./campaign-report";

/**
 * O relatório das campanhas (P10-10)
 * =========================================================================
 * O que estes testes fixam é a **conta** — qual é o denominador de cada taxa —
 * e o formato que faz o ficheiro abrir no Excel português sem assistente de
 * importação. As duas coisas são invisíveis até estarem erradas, e as duas são
 * fáceis de partir sem querer.
 */

const LABELS: CampaignReportLabels = {
  name: "Campanha",
  audience: "Público",
  status: "Estado",
  recipients: "Destinatários",
  delivered: "Entregues",
  opens: "Aberturas",
  openRate: "Taxa de abertura",
  clicks: "Cliques",
  clickRate: "Taxa de cliques",
  bounces: "Devoluções",
  bounceRate: "Taxa de devolução",
  unsubscribes: "Cancelamentos",
  sentAt: "Enviada em",
};

const FORMAT = { audience: (v: string) => v, status: (v: string) => v };

function campanha(over: Partial<CampaignReportRow["campaign"]> = {}): CampaignReportRow {
  return {
    campaign: {
      name: "Outono",
      audience: "owners",
      status: "sent",
      recipients: 100,
      opens: 0,
      clicks: 0,
      bounces: 0,
      unsubscribes: 0,
      sent_at: "2026-10-15T09:00:00.000Z",
      created_at: "2026-10-14T09:00:00.000Z",
      ...over,
    },
  };
}

describe("entregues", () => {
  it("é destinatários menos devoluções", () => {
    expect(deliveredOf(campanha({ recipients: 100, bounces: 12 }).campaign)).toBe(88);
  });

  it("nunca é negativo, por muito estranha que a contagem venha", () => {
    expect(deliveredOf(campanha({ recipients: 2, bounces: 9 }).campaign)).toBe(0);
  });
});

describe("as taxas", () => {
  it("arredonda a uma casa decimal", () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(2, 3)).toBe(66.7);
  });

  it("denominador zero é `null` e não zero — a diferença é o que o ecrã mostra", () => {
    // "0%" sobre zero entregues é uma afirmação falsa sobre uma campanha que
    // ainda não saiu; `null` deixa a célula vazia.
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
  });

  it("a abertura mede-se sobre entregues, não sobre destinatários", () => {
    // 100 destinatários, 50 devoluções, 25 aberturas: 50% de quem recebeu, e
    // não 25% de quem estava na lista. Incluir as devoluções no denominador
    // fazia a campanha parecer pior do que foi e escondia o problema real.
    const row = campanha({ recipients: 100, bounces: 50, opens: 25 }).campaign;
    expect(rate(row.opens, deliveredOf(row))).toBe(50);
  });

  it("a devolução mede-se sobre destinatários — é a lista que se está a medir", () => {
    const row = campanha({ recipients: 200, bounces: 20 }).campaign;
    expect(rate(row.bounces, row.recipients)).toBe(10);
  });
});

describe("o CSV", () => {
  it("abre no Excel português: BOM, ponto e vírgula e decimal com vírgula", () => {
    const csv = campaignReportCsv(
      [campanha({ recipients: 100, bounces: 0, opens: 1, clicks: 0 })],
      LABELS,
      FORMAT,
    );

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Campanha";"Público"');
    // 1 em 100 = 1%, e sem vírgula decimal não haveria nada a provar aqui;
    // 1 em 3 é o caso que mostra o formato.
    const tres = campaignReportCsv([campanha({ recipients: 3, opens: 1 })], LABELS, FORMAT);
    expect(tres).toContain(";33,3;");
  });

  it("termina as linhas com CRLF, como o RFC 4180", () => {
    const csv = campaignReportCsv([campanha()], LABELS, FORMAT);
    expect(csv).toContain("\r\n");
  });

  it("escapa as aspas em vez de partir a coluna", () => {
    const csv = campaignReportCsv([campanha({ name: 'Campanha "Outono"' })], LABELS, FORMAT);
    expect(csv).toContain('"Campanha ""Outono"""');
  });

  it("um ponto e vírgula no nome não cria uma coluna a mais", () => {
    const csv = campaignReportCsv([campanha({ name: "Outono; Inverno" })], LABELS, FORMAT);
    const linha = csv.split("\r\n")[1]!;
    // Treze colunas, com o nome inteiro na primeira — é o que as aspas garantem.
    expect(linha.startsWith('"Outono; Inverno";')).toBe(true);
  });

  it("uma campanha sem envio deixa as taxas e a data em branco", () => {
    const csv = campaignReportCsv(
      [campanha({ status: "draft", recipients: 0, sent_at: null })],
      LABELS,
      FORMAT,
    );
    const linha = csv.split("\r\n")[1]!;
    expect(linha.endsWith(';0;""')).toBe(false);
    // As três taxas saem vazias, lado a lado com os zeros das contagens.
    expect(linha).toContain(";0;;0;;0;;0;");
  });

  it("traduz a audiência e o estado por quem o chama", () => {
    const csv = campaignReportCsv([campanha({ audience: "owners", status: "sent" })], LABELS, {
      audience: () => "Proprietários",
      status: () => "Enviada",
    });
    expect(csv).toContain('"Proprietários"');
    expect(csv).toContain('"Enviada"');
  });

  it("sem campanhas sai só o cabeçalho", () => {
    const csv = campaignReportCsv([], LABELS, FORMAT);
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });
});
