"use client";

import { useTransition } from "react";
import { CloudUpload, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusTag,
  Table,
  useToast,
  type StatusTone,
  type TableColumn,
} from "@upm/ui";
import { CAMPAIGN_STATUS_TONES, type CampaignRow, type CampaignStatus } from "@upm/db/campaigns";
import { deliveredOf, rate } from "@upm/db/campaign-report";

import type { MetricsResult } from "./actions";

/**
 * Métricas de e-mail — `/marketing/metricas` (P10-10 · 04 §2.6)
 * =========================================================================
 * A leitura das campanhas que já saíram. Os números vêm dos contadores de
 * `campaigns`, que P10-09 passou a encher a partir de `email_events` — e é por
 * isso que esta página só pôde nascer depois dela.
 *
 * ## As taxas medem-se sobre entregues, e o ecrã di-lo
 *
 * Um e-mail que devolveu não teve oportunidade de ser aberto. Pôr os
 * destinatários no denominador faz uma campanha com muitas devoluções parecer
 * pior do que foi, e esconde o problema verdadeiro, que é a lista. A conta está
 * em `campaign-report.ts`, partilhada com o CSV — dois sítios a dividir davam
 * dois números com o mesmo nome.
 *
 * ## Zero não é o mesmo que ainda não há
 *
 * Uma campanha em rascunho não tem taxa nenhuma: a célula fica vazia, e não a
 * "0%" que se lê como "ninguém abriu". `rate()` devolve `null` com denominador
 * zero precisamente para isso.
 *
 * ## Os números podem estar todos a zero por uma razão que não é esta página
 *
 * Enquanto o webhook do Resend não estiver apontado e o `RESEND_WEBHOOK_SECRET`
 * posto, não entram recibos e os contadores ficam onde nasceram. É confirmação
 * de produção (07 §16.1) e está escrito no doc 09; o aviso em baixo existe para
 * ninguém concluir daqui que as campanhas não chegaram.
 */

export type MetricsViewProps = {
  campaigns: CampaignRow[];
  /** Quantos recibos existem ao todo — zero diz que o webhook ainda não fala. */
  receiptCount: number;
  locale: string;
  onDownload: () => Promise<MetricsResult>;
  onSaveToCloud: () => Promise<MetricsResult>;
};

export function MetricsView(props: MetricsViewProps) {
  const t = useTranslations("marketing.metrics");
  const tc = useTranslations("marketing.campaigns");
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const dateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "medium",
  });

  /** A percentagem como se lê, ou travessão quando não há denominador. */
  function percent(part: number, whole: number) {
    const value = rate(part, whole);
    return value === null ? "—" : `${String(value).replace(".", ",")}%`;
  }

  function descarregar() {
    startTransition(async () => {
      const result = await props.onDownload();
      if (result.error || !result.csv) {
        toast(result.error ?? t("downloadFailed"), "error");
        return;
      }
      // O ficheiro sai do browser a partir do texto que o servidor compôs — o
      // mesmo caminho do "Exportar HTML" das campanhas, e pela mesma razão: não
      // há nada a ganhar em passar por um endpoint de descarga.
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename ?? "campanhas.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  function guardar() {
    startTransition(async () => {
      const result = await props.onSaveToCloud();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      if (result.notice) toast(result.notice, "success");
    });
  }

  const columns: TableColumn<CampaignRow>[] = [
    {
      id: "name",
      header: t("columns.name"),
      cell: (row) => (
        <span style={{ display: "grid", gap: "2px" }}>
          <span style={{ color: "var(--text)" }}>{row.name}</span>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            {tc(`audience.${row.audience}`)}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: (row) => (
        <span style={{ display: "grid", gap: "2px" }}>
          <span>
            <StatusTag tone={CAMPAIGN_STATUS_TONES[row.status as CampaignStatus] as StatusTone}>
              {tc(`status.${row.status}`)}
            </StatusTag>
          </span>
          {row.sent_at ? (
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {dateFormat.format(new Date(row.sent_at))}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "recipients",
      header: t("columns.recipients"),
      numeric: true,
      cell: (row) => row.recipients,
    },
    {
      id: "delivered",
      header: t("columns.delivered"),
      numeric: true,
      cell: (row) => deliveredOf(row),
    },
    {
      id: "opens",
      header: t("columns.openRate"),
      numeric: true,
      cell: (row) => (
        <span title={t("countOf", { count: row.opens })}>
          {percent(row.opens, deliveredOf(row))}
        </span>
      ),
    },
    {
      id: "clicks",
      header: t("columns.clickRate"),
      numeric: true,
      cell: (row) => (
        <span title={t("countOf", { count: row.clicks })}>
          {percent(row.clicks, deliveredOf(row))}
        </span>
      ),
    },
    {
      id: "bounces",
      header: t("columns.bounceRate"),
      numeric: true,
      cell: (row) => (
        <span title={t("countOf", { count: row.bounces })}>
          {percent(row.bounces, row.recipients)}
        </span>
      ),
    },
    {
      id: "unsubscribes",
      header: t("columns.unsubscribes"),
      numeric: true,
      cell: (row) => row.unsubscribes,
    },
  ];

  const enviadas = props.campaigns.filter(
    (row) => row.status === "sent" || row.status === "sending",
  );

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            <Button
              variant="secondary"
              leadingIcon={<Download size={15} />}
              disabled={pending || props.campaigns.length === 0}
              onClick={descarregar}
            >
              {t("download")}
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<CloudUpload size={15} />}
              disabled={pending || props.campaigns.length === 0}
              title={t("saveHint")}
              onClick={guardar}
            >
              {t("save")}
            </Button>
          </span>
        }
      />

      {/* O aviso que impede a conclusão errada — ver a nota de topo. */}
      {enviadas.length > 0 && props.receiptCount === 0 ? (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "var(--sp-3) var(--sp-4)",
            border: "1px solid var(--warn)",
            borderRadius: "var(--r-md)",
            background: "var(--warn-soft)",
            color: "var(--warn)",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {t("noReceiptsNote")}
        </p>
      ) : null}

      {props.campaigns.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <Table
          caption={t("tableCaption")}
          columns={columns}
          rows={props.campaigns}
          rowKey={(row) => row.id}
        />
      )}
    </div>
  );
}
