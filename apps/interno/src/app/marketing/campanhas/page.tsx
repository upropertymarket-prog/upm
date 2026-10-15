import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import {
  campaignAudienceCount,
  campaignSenderOptions,
  delayInDays,
  listCampaignEmails,
  listCampaigns,
  parseCampaignBlocks,
  type CampaignAudience,
} from "@upm/db/campaigns";
import type { CampaignBlock } from "@upm/db/campaign-blocks";

import { InternalChrome } from "../../../components/InternalChrome";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { setLocalePreference } from "../../actions/preferences";
import {
  agendarCampanha,
  apagarCampanha,
  apagarEmail,
  carregarImagem,
  contarAudiencia,
  desagendarCampanha,
  enviarCampanha,
  enviarTeste,
  guardarCampanha,
  guardarEmail,
  preverCampanha,
} from "./actions";
import { CampaignBuilder } from "./CampaignBuilder";

/**
 * `/marketing/campanhas` — o construtor de campanhas (P10-08 · 04 §2.6)
 * =========================================================================
 * **A campanha aberta e o e-mail aberto vivem no URL** (`?campanha=&email=`),
 * ao contrário das Atualizações, que não têm estado no URL. A diferença é
 * deliberada e tem duas razões: uma campanha em preparação é exatamente o tipo
 * de coisa que se passa a um colega por link — "vê este terceiro e-mail da
 * sequência" — e a sequência tem navegação própria, com separadores, que sem
 * URL ficava inalcançável de fora. É a mesma decisão dos tickets e da caixa de
 * e-mail.
 *
 * O que o servidor lê: as campanhas, os e-mails **da campanha aberta** (e não
 * de todas), os remetentes possíveis, a contagem da audiência e a lista de
 * imóveis para o bloco de destaque. Os blocos são validados aqui contra o
 * contrato — `parseCampaignBlocks` — para que o construtor receba blocos e não
 * `jsonb` por validar.
 *
 * Os imóveis vêm de `properties_public`, que é o único caminho de leitura
 * pública de `properties` (08 §2.7) e corre com os direitos do dono da view. É
 * o que deixa o Marketing escolher um imóvel **sem** lhe dar leitura da tabela
 * — e sem lhe dar nada do dono dele.
 */

export const dynamic = "force-dynamic";

export default async function MarketingCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ campanha?: string; email?: string }>;
}) {
  const supabase = createClient(await cookies());
  const [t, params] = await Promise.all([getTranslations(), searchParams]);

  const [campaigns, senders, shell, properties] = await Promise.all([
    listCampaigns(supabase),
    campaignSenderOptions(supabase),
    getMarketingShellData(supabase, t("sidebar.groups.marketing")),
    listarImoveis(supabase),
  ]);

  // Sem `?campanha=`, abre a mais recente — que é a que se estava a escrever.
  const selected = params.campanha
    ? (campaigns.find((row) => row.id === params.campanha) ?? null)
    : (campaigns[0] ?? null);

  const emails = selected ? await listCampaignEmails(supabase, selected.id) : [];
  const selectedEmailId = params.email
    ? (emails.find((row) => row.id === params.email)?.id ?? emails[0]?.id ?? null)
    : (emails[0]?.id ?? null);

  const blocksByEmail: Record<string, CampaignBlock[]> = {};
  const delayByEmail: Record<string, number> = {};
  for (const row of emails) {
    blocksByEmail[row.id] = parseCampaignBlocks(row.blocks);
    delayByEmail[row.id] = delayInDays(row.delay);
  }

  const audienceCount = selected
    ? await campaignAudienceCount(supabase, selected.audience as CampaignAudience)
    : null;

  return (
    <InternalChrome
      role="marketing"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="campaigns"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <CampaignBuilder
        campaigns={campaigns}
        selected={selected}
        emails={emails}
        blocksByEmail={blocksByEmail}
        delayByEmail={delayByEmail}
        selectedEmailId={selectedEmailId}
        senders={senders}
        properties={properties}
        audienceCount={audienceCount}
        locale={shell.locale}
        onSaveCampaign={guardarCampanha}
        onDeleteCampaign={apagarCampanha}
        onSaveEmail={guardarEmail}
        onDeleteEmail={apagarEmail}
        onSchedule={agendarCampanha}
        onUnschedule={desagendarCampanha}
        onSend={enviarCampanha}
        onSendTest={enviarTeste}
        onCountAudience={contarAudiencia}
        onPreview={preverCampanha}
        onUploadImage={carregarImagem}
      />
    </InternalChrome>
  );
}

/**
 * Os imóveis para o bloco de destaque — título e cidade, e mais nada.
 *
 * Os 60 mais recentes e não todos: é um seletor e não um catálogo, e quem
 * destaca um imóvel numa campanha destaca um que acabou de entrar. Se um dia
 * forem precisos mais, o que isto pede é procura — e não uma lista maior.
 */
async function listarImoveis(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("properties_public")
    .select("id, title, city")
    .order("published_at", { ascending: false })
    .limit(60);

  return (data ?? [])
    .filter((row): row is { id: string; title: string | null; city: string | null } =>
      Boolean(row.id),
    )
    .map((row) => ({
      id: row.id,
      label: [row.title, row.city].filter(Boolean).join(" · ") || row.id,
    }));
}
