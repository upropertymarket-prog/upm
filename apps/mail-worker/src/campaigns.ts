import { Resend } from "resend";

import {
  renderCampaignHtml,
  renderCampaignText,
  type CampaignRenderContext,
} from "@upm/db/campaign-render";
import { campaignBlocksSchema, type CampaignBlock } from "@upm/db/campaign-blocks";

import { describe } from "./connection.ts";
import type { Env } from "./env.ts";
import type { MailWorkerClient } from "./supabase.ts";

/**
 * O envio das campanhas (P10-08, 3.ª parte · 04 §2.6 · 07 §24.6)
 * =========================================================================
 * O construtor compõe, as funções `security definer` materializam os
 * destinatários **dentro do Postgres** (07 §24.6 #5), e este ficheiro entrega.
 * A app nunca chega aqui: pede `campaign_send_now()`, a campanha fica em
 * `sending`, e a passagem seguinte deste ciclo leva-a.
 *
 * ## Pelo Resend, e não pelo SMTP da caixa
 *
 * É a diferença em relação a `send.ts`, que responde a clientes pelo SMTP da
 * Amen. Uma resposta de suporte **tem** de sair da caixa onde a conversa vive;
 * uma campanha para milhares de pessoas não pode sair de uma caixa de correio
 * normal — o servidor dela não tem reputação de envio em massa nem quota para
 * isso, e um envio assim é a forma mais rápida de ir para a pasta de spam. O
 * que a caixa dá é a **identidade** (07 §24.6 #2): o nome e o endereço no
 * `from`.
 *
 * `CAMPAIGN_FROM` existe por cima disso para o período em que o domínio ainda
 * não está verificado no Resend (confirmação de produção, 07 §16.1). Sem ele, o
 * `from` é o da caixa — que é o comportamento certo e o que vai ficar.
 *
 * ## Renderizado por destinatário, e não por campanha
 *
 * Duas coisas mudam em cada e-mail: as variáveis (`{nome} {apelido} {plano}`) e
 * o `unsubscribe_token`. Por isso o HTML compõe-se por pessoa — com a **mesma**
 * `renderCampaignHtml` que a pré-visualização do construtor usa, que é o que
 * garante que o que se viu no ecrã é o que sai.
 *
 * O que **não** muda por pessoa fica em cache durante a passagem: a assinatura
 * da caixa, o cartão do imóvel e a identidade do remetente. Sem isso, uma
 * campanha para dez mil pessoas fazia trinta mil leituras para ir buscar sempre
 * o mesmo.
 */

export type CampaignReport = {
  sent: number;
  failed: number;
  advanced: number;
  reason?: string;
};

type Claimed = {
  recipient_id: string;
  campaign_id: string;
  campaign_email_id: string;
  email: string;
  unsubscribe_token: string;
  var_nome: string;
  var_apelido: string;
  var_plano: string;
  subject: string;
  preheader: string;
  blocks: unknown;
  email_bg: string;
  from_mailbox_id: string | null;
};

export async function drainCampaigns(
  client: MailWorkerClient,
  env: Env,
  options: { batch: number },
): Promise<CampaignReport> {
  const report: CampaignReport = { sent: 0, failed: 0, advanced: 0 };

  if (!env.RESEND_API_KEY) {
    report.reason = "RESEND_API_KEY não está definida — as campanhas ficam na fila.";
    return report;
  }

  /**
   * Primeiro a sequência, depois a fila: um e-mail cuja espera acabou passa a
   * ter destinatários **antes** de reclamarmos o lote, e sai nesta passagem em
   * vez de na seguinte. Pela ordem inversa, cada e-mail de sequência ganhava um
   * atraso extra de um ciclo sem razão nenhuma.
   */
  const { data: advanced, error: advanceError } = await client.rpc("campaign_advance_sequence");
  if (advanceError) throw new Error(`Não foi possível avançar sequências: ${advanceError.message}`);
  report.advanced = typeof advanced === "number" ? advanced : 0;

  const { data, error } = await client.rpc("campaign_claim_recipients", {
    p_limit: options.batch,
  });
  if (error) throw new Error(`Não foi possível reclamar destinatários: ${error.message}`);

  const claimed = (data ?? []) as Claimed[];
  if (claimed.length === 0) return report;

  const resend = new Resend(env.RESEND_API_KEY);
  const cache = new Caches(client, env);

  for (const row of claimed) {
    try {
      const comum = await cache.forEmail(row);
      const blocks = parseBlocks(row.blocks);

      // Sem blocos válidos não se envia e não se tenta outra vez: o conteúdo
      // não vai melhorar por ser tentado cinco vezes. Marca-se com o motivo.
      if (blocks.length === 0) {
        await falhar(client, row.recipient_id, "Os blocos guardados não passam o contrato.");
        report.failed += 1;
        continue;
      }

      const context: CampaignRenderContext = {
        assetBaseUrl: comum.assetBaseUrl,
        // O token é por destinatário — um link partilhado deixava qualquer
        // pessoa cancelar a subscrição de outra (`20261015090000`).
        unsubscribeUrl: `${env.WEB_URL}/cancelar-subscricao?t=${row.unsubscribe_token}`,
        signatureHtml: comum.signatureHtml,
        property: comum.property,
        values: {
          nome: row.var_nome,
          apelido: row.var_apelido,
          plano: row.var_plano,
        },
        labels: { unsubscribe: "Cancelar subscrição" },
        preheader: row.preheader || undefined,
        background: row.email_bg,
      };

      const html = await renderCampaignHtml(blocks, context);
      const text = renderCampaignText(blocks, context);

      const sent = await resend.emails.send({
        from: comum.from,
        to: row.email,
        subject: row.subject,
        html,
        text,
        headers: {
          /**
           * `List-Unsubscribe` com o mesmo URL do rodapé. Não é decoração: o
           * Gmail e o Outlook mostram o "Cancelar subscrição" deles a partir
           * deste cabeçalho, e uma campanha sem ele é tratada com mais
           * desconfiança pelos filtros. É o complemento técnico do que 02 §4.3
           * exige por lei.
           */
          "List-Unsubscribe": `<${context.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      if (sent.error) throw new Error(sent.error.message);

      const { error: marcar } = await client.rpc("campaign_recipient_sent", {
        p_id: row.recipient_id,
      });
      if (marcar) throw new Error(marcar.message);

      report.sent += 1;
    } catch (sendError) {
      await falhar(client, row.recipient_id, describe(sendError));
      report.failed += 1;
    }
  }

  return report;
}

/**
 * "Enviar teste" (04 §2.6) — um e-mail só, para quem está a escrever
 * =========================================================================
 * Três coisas que o distinguem de um envio a sério, e todas são decisões:
 *
 * 1. **Não cria destinatário.** Nenhuma linha em `campaign_recipients`: um
 *    teste contado no alcance da campanha sujava a métrica com os ensaios de
 *    quem a escreveu.
 * 2. **Lê o que está guardado**, pelo `id` do e-mail da sequência, e não os
 *    blocos que o ecrã tinha na mão. Um teste sobre o rascunho não gravado
 *    prova uma coisa e o envio faz outra.
 * 3. **O assunto leva um prefixo.** `[TESTE]` à frente, porque este e-mail cai
 *    na caixa de alguém da equipa ao lado de campanhas verdadeiras, e a
 *    diferença tem de ser visível antes de ser aberto.
 *
 * As variáveis saem com uma amostra — os mesmos valores da pré-visualização do
 * construtor, pela mesma razão: 07 §24.6 #5 não deixa ir buscar um
 * destinatário real para ensaiar.
 */
export async function sendCampaignTest(
  client: MailWorkerClient,
  env: Env,
  request: { campaignEmailId: string; to: string },
): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não está definida no mail-worker.");

  const { data: email, error } = await client
    .from("campaign_emails")
    .select("id, campaign_id, subject, preheader, blocks")
    .eq("id", request.campaignEmailId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível ler o e-mail: ${error.message}`);
  if (!email) throw new Error("Este e-mail da campanha já não existe.");

  const blocks = parseBlocks(email.blocks);
  if (blocks.length === 0) throw new Error("Este e-mail não tem blocos válidos.");

  const { data: campaign } = await client
    .from("campaigns")
    .select("email_bg, from_mailbox_id")
    .eq("id", email.campaign_id)
    .maybeSingle();

  const cache = new Caches(client, env);
  const comum = await cache.forEmail({
    recipient_id: "",
    campaign_id: email.campaign_id,
    campaign_email_id: email.id,
    email: request.to,
    unsubscribe_token: "",
    var_nome: "",
    var_apelido: "",
    var_plano: "",
    subject: email.subject,
    preheader: email.preheader,
    blocks: email.blocks,
    email_bg: campaign?.email_bg ?? "#f6f7f9",
    from_mailbox_id: campaign?.from_mailbox_id ?? null,
  });

  const context: CampaignRenderContext = {
    assetBaseUrl: comum.assetBaseUrl,
    // Um link de cancelamento que não cancela nada: é um teste, e não há
    // destinatário com token. O token inexistente devolve `false` na função e o
    // site mostra que o link não é válido — o que é a verdade.
    unsubscribeUrl: `${env.WEB_URL}/cancelar-subscricao?t=teste`,
    signatureHtml: comum.signatureHtml,
    property: comum.property,
    values: AMOSTRA,
    labels: { unsubscribe: "Cancelar subscrição" },
    preheader: email.preheader || undefined,
    background: campaign?.email_bg ?? undefined,
  };

  const resend = new Resend(env.RESEND_API_KEY);
  const sent = await resend.emails.send({
    from: comum.from,
    to: request.to,
    subject: `[TESTE] ${email.subject || "(sem assunto)"}`,
    html: await renderCampaignHtml(blocks, context),
    text: renderCampaignText(blocks, context),
  });

  if (sent.error) throw new Error(sent.error.message);
}

/** Os mesmos valores do "Com dados" do construtor — uma amostra, não uma pessoa. */
const AMOSTRA = { nome: "Ana", apelido: "Martins", plano: "Premium" } as const;

async function falhar(
  client: MailWorkerClient,
  recipientId: string,
  motivo: string,
): Promise<void> {
  // A política das tentativas é da função (volta a `pending` até às cinco, e
  // depois `failed`), e é a mesma de `notification_deliveries`.
  await client.rpc("campaign_recipient_failed", {
    p_id: recipientId,
    p_error: motivo.slice(0, 500),
  });
}

function parseBlocks(value: unknown): CampaignBlock[] {
  const parsed = campaignBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * O que é comum a todos os destinatários do mesmo e-mail da sequência.
 *
 * Uma instância por passagem, descartada no fim: a assinatura e o cartão do
 * imóvel podem mudar entre passagens, e guardá-los entre ciclos fazia uma
 * campanha longa sair com dados de há uma hora.
 */
type Comum = {
  assetBaseUrl: string;
  from: string;
  signatureHtml: string;
  property: CampaignRenderContext["property"];
};

class Caches {
  private readonly porEmail = new Map<string, Comum>();
  private readonly porCaixa = new Map<string, string>();

  constructor(
    private readonly client: MailWorkerClient,
    private readonly env: Env,
  ) {}

  async forEmail(row: Claimed): Promise<Comum> {
    const cached = this.porEmail.get(row.campaign_email_id);
    if (cached) return cached;

    const assetBaseUrl = `${this.env.SUPABASE_URL}/storage/v1/object/public/campaign-assets`;

    const [signatureHtml, property, from] = await Promise.all([
      this.signature(row.campaign_email_id),
      this.property(row),
      this.from(row.from_mailbox_id),
    ]);

    const comum: Comum = { assetBaseUrl, from, signatureHtml, property };
    this.porEmail.set(row.campaign_email_id, comum);
    return comum;
  }

  /** Resolvida no Postgres: ler o `mailboxId` dos blocos aqui dava dois sítios a conhecer o contrato. */
  private async signature(campaignEmailId: string): Promise<string> {
    const { data } = await this.client.rpc("campaign_signature_html", {
      p_campaign_email_id: campaignEmailId,
    });
    return typeof data === "string" ? data : "";
  }

  /**
   * A identidade do remetente — nome e endereço da caixa (07 §24.6 #2).
   *
   * `CAMPAIGN_FROM` ganha-lhe quando está definido, e é o que permite enviar
   * enquanto o domínio não está verificado no Resend. Sem caixa **e** sem
   * `CAMPAIGN_FROM`, cai no `MAIL_FROM` das notificações: é pouco, mas é um
   * remetente que existe, e `campaign_send_now()` já recusa enviar sem caixa.
   */
  private async from(mailboxId: string | null): Promise<string> {
    if (this.env.CAMPAIGN_FROM) return this.env.CAMPAIGN_FROM;
    if (!mailboxId) return this.env.MAIL_FROM;

    const cached = this.porCaixa.get(mailboxId);
    if (cached) return cached;

    const { data } = await this.client
      .from("mailboxes")
      .select("address, display_name")
      .eq("id", mailboxId)
      .maybeSingle();

    const from = data?.address
      ? `${data.display_name || "UProperty Market"} <${data.address}>`
      : this.env.MAIL_FROM;

    this.porCaixa.set(mailboxId, from);
    return from;
  }

  /**
   * O cartão do imóvel em destaque — **e a cópia da capa para o bucket público**
   * =========================================================================
   * Esta é a peça que o construtor não podia ter. As fotografias vivem em
   * `property-media`, que é privado, e um URL assinado expira numa hora: num
   * e-mail aberto duas semanas depois é um retângulo partido. É exatamente a
   * razão por que o bucket das campanhas é público (05 §1.4).
   *
   * Por isso a capa é **copiada** para `campaign-assets` no momento do envio,
   * sob `campanhas/{campaign_email_id}/`. Só o worker pode fazê-lo: exige ler um
   * bucket privado e escrever noutro, e a `service_role` é dele (02 §3.3).
   *
   * `upsert: true` porque a mesma campanha pode ser retomada depois de uma
   * falha, e a segunda passagem encontra a cópia já lá.
   *
   * Se a cópia falhar, o cartão sai **sem foto** em vez de sair com uma imagem
   * que não abre — o renderizador já aceita `imageUrl` opcional por isto.
   */
  private async property(row: Claimed): Promise<CampaignRenderContext["property"]> {
    const blocks = parseBlocks(row.blocks);
    const block = blocks.find((candidate) => candidate.type === "property");
    if (!block || block.type !== "property" || !block.propertyId) return null;

    const { data } = await this.client
      .from("properties_public")
      .select("id, title, city, deal, price_cents, rent_cents")
      .eq("id", block.propertyId)
      .maybeSingle();

    if (!data?.id) return null;

    const cents = data.deal === "rent" ? data.rent_cents : data.price_cents;
    const preco = new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format((cents ?? 0) / 100);

    return {
      title: data.title ?? "",
      location: data.city ?? "",
      price: data.deal === "rent" ? `${preco}/mês` : preco,
      url: `${this.env.WEB_URL}/imoveis/${data.id}`,
      imageUrl: await this.cover(row.campaign_email_id, data.id),
    };
  }

  private async cover(campaignEmailId: string, propertyId: string): Promise<string | undefined> {
    const { data: media } = await this.client
      .from("property_media")
      .select("path")
      .eq("property_id", propertyId)
      .order("is_cover", { ascending: false })
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!media?.path) return undefined;

    const extensao = /\.[a-z0-9]+$/i.exec(media.path)?.[0] ?? ".jpg";
    const destino = `campanhas/${campaignEmailId}/${propertyId}${extensao}`;

    try {
      const origem = await this.client.storage.from("property-media").download(media.path);
      if (origem.error || !origem.data) return undefined;

      const enviado = await this.client.storage
        .from("campaign-assets")
        .upload(destino, origem.data, { upsert: true, contentType: origem.data.type });

      if (enviado.error) return undefined;

      const { data: publico } = this.client.storage.from("campaign-assets").getPublicUrl(destino);
      return publico.publicUrl;
    } catch {
      // Uma capa que não copia não trava a campanha: o cartão sai sem foto.
      return undefined;
    }
  }
}
