"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { recordStaffRead } from "@upm/db/audit";
import { registerStaffCloudFile, staffCloudFolder } from "@upm/db/cloud";
import { listCampaigns } from "@upm/db/campaigns";
import { campaignReportCsv, type CampaignReportLabels } from "@upm/db/campaign-report";

/**
 * O relatório das Métricas (P10-10 · 04 §2.6 · 07 §24.6)
 * =========================================================================
 * Duas saídas para **o mesmo** relatório: descarregar e guardar na Cloud
 * interna. `campaignReportCsv` é uma função pura e é a única que sabe compor o
 * CSV — as duas ações abaixo apenas decidem onde o texto aterra. Dois
 * geradores davam dois relatórios com o mesmo nome e números diferentes, que é
 * precisamente o erro que esta fase passou a tarefa toda a evitar.
 *
 * ## A pasta chama-se sempre o mesmo, e é de propósito
 *
 * `staff_cloud_folder()` cria-a à primeira e devolve a mesma daí em diante. Um
 * relatório por mês durante um ano são doze ficheiros; doze ficheiros na raiz
 * da gaveta da equipa são doze razões para ninguém lá mexer.
 */

export type MetricsResult = {
  ok?: boolean;
  error?: string;
  notice?: string;
  /** O CSV em texto, para o browser o descarregar. */
  csv?: string;
  filename?: string;
};

async function getMarketingClient() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return ["marketing", "admin"].includes(profile?.role ?? "")
    ? { supabase, userId: user.id }
    : null;
}

/**
 * Compõe o relatório com as etiquetas do idioma de quem o pediu.
 *
 * As traduções vêm do servidor (`getTranslations`) e não do cliente: o CSV é
 * composto aqui, e mandá-las de lá para cá era pôr o ecrã a decidir o conteúdo
 * de um ficheiro que a Cloud vai guardar.
 */
async function compor(supabase: NonNullable<Awaited<ReturnType<typeof getMarketingClient>>>) {
  const [t, tc, campaigns] = await Promise.all([
    getTranslations("marketing.metrics"),
    getTranslations("marketing.campaigns"),
    listCampaigns(supabase.supabase),
  ]);

  const labels: CampaignReportLabels = {
    name: t("columns.name"),
    audience: t("columns.audience"),
    status: t("columns.status"),
    recipients: t("columns.recipients"),
    delivered: t("columns.delivered"),
    opens: t("columns.opens"),
    openRate: t("columns.openRate"),
    clicks: t("columns.clicks"),
    clickRate: t("columns.clickRate"),
    bounces: t("columns.bounces"),
    bounceRate: t("columns.bounceRate"),
    unsubscribes: t("columns.unsubscribes"),
    sentAt: t("columns.sentAt"),
  };

  const csv = campaignReportCsv(
    campaigns.map((campaign) => ({ campaign })),
    labels,
    {
      audience: (value) => tc(`audience.${value}`),
      status: (value) => tc(`status.${value}`),
    },
  );

  // `campanhas-2026-10-15.csv`: a data no nome é o que distingue dois
  // relatórios na mesma pasta sem obrigar a abrir os dois.
  const filename = `campanhas-${new Date().toISOString().slice(0, 10)}.csv`;
  return { csv, filename, total: campaigns.length };
}

export async function descarregarRelatorio(): Promise<MetricsResult> {
  const session = await getMarketingClient();
  if (!session) return { error: "Sem permissão para ler métricas." };

  const { csv, filename, total } = await compor(session);
  if (total === 0) return { error: "Ainda não há campanhas para relatar." };

  // O relatório sai da plataforma: fica registado quem o levou (A8).
  await recordStaffRead(session.supabase, { action: "report.exported", entity: "campaign_report" });
  return { ok: true, csv, filename };
}

export async function guardarRelatorioNaCloud(): Promise<MetricsResult> {
  const session = await getMarketingClient();
  if (!session) return { error: "Sem permissão para guardar na Cloud interna." };

  const { csv, filename, total } = await compor(session);
  if (total === 0) return { error: "Ainda não há campanhas para relatar." };

  // Fica na Cloud interna e não sai — mas é a mesma exportação, e regista-se
  // pela mesma razão: quem a fez e quando (A8).
  await recordStaffRead(session.supabase, { action: "report.exported", entity: "campaign_report" });

  const bytes = new TextEncoder().encode(csv);
  const storagePath = `${session.userId}/${randomUUID()}/1`;

  const upload = await session.supabase.storage
    .from("cloud")
    .upload(storagePath, bytes, { contentType: "text/csv; charset=utf-8", upsert: false });
  if (upload.error) return { error: "Não foi possível guardar na Cloud interna." };

  try {
    const folderId = await staffCloudFolder(session.supabase, "Relatórios de campanha");

    await registerStaffCloudFile(session.supabase, {
      name: filename,
      /**
       * `text/csv` e não um dos três tipos de `ALLOWED_FILE_MIMES`: aquela
       * lista é a do **upload de quem carrega** (07 §19.8 #2, validada por
       * assinatura de conteúdo), e um CSV não tem assinatura nenhuma para
       * validar. Este ficheiro não vem de fora — é composto aqui, a partir de
       * linhas da nossa base de dados, e `cloud_register_staff_file` não
       * restringe o MIME precisamente porque o lado interno também guarda
       * anexos de correio, que são de qualquer tipo.
       */
      mime: "text/csv",
      size: bytes.byteLength,
      storagePath,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      source: "campaign_report",
      folderId,
    });
  } catch (error) {
    // A linha não entrou: o objeto sai do bucket, como em `staff-cloud.ts`.
    await session.supabase.storage.from("cloud").remove([storagePath]);
    const detail = error instanceof Error ? error.message : "";
    return {
      error: detail.includes("Cloud interna")
        ? detail
        : "Não foi possível registar o relatório na Cloud.",
    };
  }

  revalidatePath("/marketing/cloud");
  revalidatePath("/suporte/cloud");
  return { ok: true, notice: `Relatório guardado na Cloud interna, em "Relatórios de campanha".` };
}
