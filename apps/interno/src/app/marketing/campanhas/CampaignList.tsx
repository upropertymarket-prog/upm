"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusTag, type StatusTone } from "@upm/ui";
import { CAMPAIGN_STATUS_TONES, type CampaignRow, type CampaignStatus } from "@upm/db/campaigns";

/**
 * A lista de campanhas — `/marketing/campanhas` sem nenhuma aberta
 * =========================================================================
 * Este ecrã nasceu de um defeito, e vale a pena ficar escrito qual: **a página
 * não desenhava nada**. O construtor inteiro vivia dentro de um
 * `{campaign ? … : null}`, e o único caso que o `null` cobria era "há
 * campanhas mas nenhuma escolhida" — que é exatamente o estado em que a página
 * abre. Quem entrava no menu Campanhas via um título, um subtítulo e um vazio.
 *
 * A nota do `CampaignBuilder` já dizia o que este ecrã tinha de ser — "o ecrã
 * de quem acaba de entrar, e o mais visto" — e a storyboard "Sem campanha
 * aberta" existia para o rever. Só que a storyboard mostrava o mesmo vazio, e
 * um vazio não denuncia um vazio: parecia um enquadramento por preencher.
 *
 * ## Porque é uma lista e não um seletor
 *
 * Escolher a campanha era um `<Select>` dentro do painel da direita, a par do
 * nome, do público e do remetente — um controlo de **navegação** no meio de
 * controlos de **edição**. Numa lista cabe o que um seletor nunca mostra: o
 * estado, o público, quantos a receberam e quando saiu. É o que distingue a
 * campanha que se procura das outras sem a ter de abrir uma a uma.
 */

export type CampaignListProps = {
  campaigns: CampaignRow[];
  /** As contagens por campanha são as da própria linha (`campaigns.recipients`). */
  locale: string;
  onOpen: (id: string) => void;
};

/**
 * A linha que resume uma campanha — "Proprietários · 184 destinatários ·
 * Enviada a 16/10/2026, 10:00".
 *
 * Vive aqui e não dentro do componente porque o cabeçalho do editor usa a
 * **mesma** linha como subtítulo: aberta a campanha, o que estava na lista
 * passa a estar debaixo do nome dela, e não se repete a conta em dois sítios.
 *
 * O *quando* é um e nunca três. Uma campanha tem `sent_at`, `scheduled_at` e
 * `updated_at`, e mostrá-las todas dava três datas a dizer coisas diferentes:
 * a que interessa é a do estado em que ela está, e é o `status` que a escolhe.
 */
export function campaignSummary(
  row: CampaignRow,
  t: (key: string, values?: Record<string, string | number>) => string,
  dateFormat: Intl.DateTimeFormat,
): string {
  const quando =
    row.status === "sent" && row.sent_at
      ? t("listSentAt", { when: dateFormat.format(new Date(row.sent_at)) })
      : row.status === "scheduled" && row.scheduled_at
        ? t("listScheduledAt", { when: dateFormat.format(new Date(row.scheduled_at)) })
        : row.updated_at
          ? t("listDraftSince", { when: dateFormat.format(new Date(row.updated_at)) })
          : t("listNever");

  return [
    t(`audience.${row.audience}`),
    t("listRecipients", { count: row.recipients ?? 0 }),
    quando,
  ].join(" · ");
}

export function CampaignList(props: CampaignListProps) {
  const t = useTranslations("marketing.campaigns");

  const dateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (props.campaigns.length === 0) {
    return (
      <section
        aria-label={t("listLabel")}
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "240px",
          padding: "var(--sp-5)",
          border: "1px dashed var(--border2)",
          borderRadius: "var(--r-lg)",
          background: "var(--surface)",
          color: "var(--muted)",
          fontSize: "13px",
          textAlign: "center",
        }}
      >
        {t("empty")}
      </section>
    );
  }

  return (
    <section
      aria-label={t("listLabel")}
      style={{
        display: "grid",
        gap: "var(--sp-1)",
        padding: "var(--sp-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
      }}
    >
      {props.campaigns.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => props.onOpen(row.id)}
          style={{
            // A mesma lição da lista das Atualizações: um item de grelha não
            // encolhe abaixo do conteúdo sem isto, e o nome de uma campanha
            // não quebra linha.
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-3)",
            width: "100%",
            minHeight: "56px",
            padding: "var(--sp-3) var(--sp-3)",
            border: 0,
            borderRadius: "var(--r-md)",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span style={{ minWidth: 0, display: "grid", gap: "2px", flex: "1 1 auto" }}>
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {row.name || t("newName")}
            </span>
            {/* O número é o da própria linha e não uma contagem nova: a lista
                não vale uma ida ao servidor por campanha, e o que interessa
                aqui é quantos a *receberam* — que é o que `recipients` guarda
                depois do envio. */}
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {campaignSummary(row, t, dateFormat)}
            </span>
          </span>

          <StatusTag tone={CAMPAIGN_STATUS_TONES[row.status as CampaignStatus] as StatusTone}>
            {t(`status.${row.status}`)}
          </StatusTag>

          <ChevronRight size={16} aria-hidden="true" color="var(--muted)" />
        </button>
      ))}
    </section>
  );
}
