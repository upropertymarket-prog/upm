import type { CampaignRow } from "./campaigns";

/**
 * O relatório das campanhas em CSV (P10-10 · 04 §2.6)
 * =========================================================================
 * Puro de propósito: recebe linhas, devolve texto. Não fala com a base de
 * dados e não sabe o que é uma Server Action — é o que permite ao mesmo
 * relatório ser descarregado pelo browser e guardado na Cloud interna sem
 * haver duas versões dele. Foi o que o construtor de campanhas fez com o HTML
 * e pela mesma razão.
 *
 * ## As taxas calculam-se aqui e não na folha de cálculo
 *
 * Um CSV com `opens` e `recipients` obriga quem o abre a escrever a divisão —
 * e a escolher o denominador, que é onde se erra. A taxa de abertura mede-se
 * sobre **entregues** e não sobre destinatários: um e-mail que devolveu não
 * teve oportunidade de ser aberto, e incluí-lo no denominador faz uma campanha
 * parecer pior do que foi. É a convenção de qualquer ferramenta de e-mail, e
 * está aqui escrita porque dentro de três meses ninguém se lembra qual era.
 *
 * ## O separador é `;` e os decimais levam vírgula
 *
 * O Excel em português abre um CSV com vírgulas numa coluna só. Isto é um
 * relatório para abrir, não um formato de troca — e um ficheiro que obriga a
 * passar pelo assistente de importação é um ficheiro que ninguém abre duas
 * vezes.
 */

/** U+FEFF — a marca de ordem de bytes que faz o Excel ler o ficheiro em UTF-8. */
const BOM = String.fromCharCode(0xfeff);

export type CampaignReportRow = {
  campaign: Pick<
    CampaignRow,
    | "name"
    | "audience"
    | "status"
    | "recipients"
    | "opens"
    | "clicks"
    | "bounces"
    | "unsubscribes"
    | "sent_at"
    | "created_at"
  >;
};

/** O que cada coluna se chama. Vem de fora para o CSV sair no idioma do painel. */
export type CampaignReportLabels = {
  name: string;
  audience: string;
  status: string;
  recipients: string;
  delivered: string;
  opens: string;
  openRate: string;
  clicks: string;
  clickRate: string;
  bounces: string;
  bounceRate: string;
  unsubscribes: string;
  sentAt: string;
};

/** Entregues = destinatários menos devoluções. Nunca negativo. */
export function deliveredOf(row: CampaignReportRow["campaign"]): number {
  return Math.max(0, row.recipients - row.bounces);
}

/**
 * A taxa, em percentagem com uma casa. Denominador zero devolve `null` e sai
 * como célula vazia — "0%" sobre zero entregues é uma afirmação falsa sobre
 * uma campanha que ainda não saiu.
 */
export function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function campaignReportCsv(
  rows: CampaignReportRow[],
  labels: CampaignReportLabels,
  format: { audience: (value: string) => string; status: (value: string) => string },
): string {
  const header = [
    labels.name,
    labels.audience,
    labels.status,
    labels.recipients,
    labels.delivered,
    labels.opens,
    labels.openRate,
    labels.clicks,
    labels.clickRate,
    labels.bounces,
    labels.bounceRate,
    labels.unsubscribes,
    labels.sentAt,
  ];

  const lines = [header.map(cell).join(";")];

  for (const { campaign } of rows) {
    const delivered = deliveredOf(campaign);
    lines.push(
      [
        cell(campaign.name),
        cell(format.audience(campaign.audience)),
        cell(format.status(campaign.status)),
        String(campaign.recipients),
        String(delivered),
        String(campaign.opens),
        percent(rate(campaign.opens, delivered)),
        String(campaign.clicks),
        percent(rate(campaign.clicks, delivered)),
        String(campaign.bounces),
        percent(rate(campaign.bounces, campaign.recipients)),
        String(campaign.unsubscribes),
        // ISO e não formatado: uma data de relatório é para ordenar e filtrar,
        // e o formato local muda com quem o abre.
        campaign.sent_at ?? "",
      ].join(";"),
    );
  }

  /**
   * O BOM à cabeça não é superstição: sem ele o Excel no Windows lê o ficheiro
   * como ANSI e as campanhas com acentos aparecem com caracteres partidos. É o
   * mesmo motivo por que o separador é `;`.
   *
   * Construído por código de carácter e **nunca** escrito literalmente: um
   * U+FEFF solto no meio de um ficheiro de código é espaço branco invisível,
   * que o `lint` recusa (`no-irregular-whitespace`) e que ninguém encontra a
   * olho quando o recusa.
   */
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

/** Aspas duplas à volta e aspas duplicadas dentro — a regra do RFC 4180. */
function cell(value: string): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

function percent(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}
