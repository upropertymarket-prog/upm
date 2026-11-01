"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { sniffImageMimeAllowed } from "@upm/db/image-mime";
import {
  campaignAudienceCount,
  campaignEmailSaveSchema,
  campaignSaveSchema,
  campaignScheduleSchema,
  campaignSignatureHtml,
  deleteCampaign,
  deleteCampaignEmail,
  saveCampaign,
  saveCampaignEmail,
  scheduleCampaign,
  sendCampaignNow,
  unscheduleCampaign,
  CAMPAIGN_AUDIENCES,
  type CampaignAudience,
} from "@upm/db/campaigns";
import { campaignBlocksSchema, type CampaignBlock } from "@upm/db/campaign-blocks";
import { renderCampaignHtml } from "@upm/db/campaign-render";

/**
 * As escritas das campanhas (P10-08 · 04 §2.6 · 07 §24.6)
 * =========================================================================
 * **O papel verificado aqui é `marketing`**, como nas Atualizações, e as sete
 * funções `security definer` de `20261015120000` repetem a verificação do seu
 * lado (07 §20.5). `is_staff()` não serve: 07 §24.6 é explícito em que não
 * inclui o marketing.
 *
 * ## O envio passa por aqui mas não acontece aqui
 *
 * `enviarCampanha` chama `campaign_send_now()`, que põe a campanha em `sending`
 * e materializa os destinatários **dentro do Postgres** — esta action nunca vê
 * um endereço (07 §24.6 #5). Quem entrega é o `mail-worker`: a app não fala com
 * SMTP (02 §3.3). `enviarTeste` é o mesmo princípio por outra porta — um `POST`
 * ao worker com o id do e-mail e o endereço, e é o worker que lê o conteúdo
 * guardado e o envia.
 *
 * ## A pré-visualização usa o renderizador a sério
 *
 * `preverCampanha` corre `renderCampaignHtml` no servidor e devolve o HTML que
 * um destinatário receberia. Não é um segundo desenho em React: a mesma função
 * que o envio usa, com as mesmas substituições de variáveis — é o que garante
 * que o "Com dados" de 04 §2.6 mostra o que sai, e não uma aproximação.
 */

export type CampaignActionResult = {
  ok?: boolean;
  error?: string;
  notice?: string;
  id?: string;
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
  return (profile?.role ?? null) === "marketing" ? supabase : null;
}

/**
 * As mensagens das funções `security definer` são escritas para serem lidas
 * (estão em português e dizem o que fazer), por isso passam ao ecrã quando
 * reconhecemos a situação, e só nesse caso. Um `error.message` cru do Postgres
 * — com o nome da restrição e o `errcode` — não é uma frase para ninguém.
 */
function explain(error: unknown, fallback: string): string {
  const detail = error instanceof Error ? error.message : "";
  const conhecidas = [
    "não se edita",
    "já não existe",
    "pelo menos um e-mail",
    "rodapé",
    "HTML inseguro",
    "no futuro",
    "sem assunto",
    "já saiu",
    "em rascunho",
    "não está agendada",
    "hexadecimal",
    "precisa de um nome",
    "consentimento de marketing",
    "Escolha o remetente",
    "não tem e-mails",
  ];
  return conhecidas.some((pedaco) => detail.includes(pedaco)) ? detail : fallback;
}

// ---------------------------------------------------------------------------
// A campanha
// ---------------------------------------------------------------------------

export async function guardarCampanha(input: unknown): Promise<CampaignActionResult> {
  const parsed = campaignSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Campanha inválida." };
  }

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para editar campanhas." };

  try {
    const id = await saveCampaign(supabase, parsed.data);
    revalidatePath("/marketing/campanhas");
    return { ok: true, id, notice: "Campanha guardada." };
  } catch (error) {
    return { error: explain(error, "Não foi possível guardar a campanha.") };
  }
}

export async function apagarCampanha(id: unknown): Promise<CampaignActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para apagar campanhas." };

  try {
    await deleteCampaign(supabase, id);
    revalidatePath("/marketing/campanhas");
    return { ok: true, notice: "Campanha apagada." };
  } catch (error) {
    return { error: explain(error, "Não foi possível apagar a campanha.") };
  }
}

// ---------------------------------------------------------------------------
// O e-mail da sequência
// ---------------------------------------------------------------------------

export async function guardarEmail(input: unknown): Promise<CampaignActionResult> {
  const parsed = campaignEmailSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para editar campanhas." };

  try {
    // A sanitização dos blocos é de `saveCampaignEmail` — é o último ponto por
    // onde o conteúdo passa antes da base de dados (02 §4.3).
    const id = await saveCampaignEmail(supabase, parsed.data);
    revalidatePath("/marketing/campanhas");
    return { ok: true, id, notice: "E-mail guardado." };
  } catch (error) {
    return { error: explain(error, "Não foi possível guardar o e-mail.") };
  }
}

export async function apagarEmail(id: unknown): Promise<CampaignActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para editar campanhas." };

  try {
    await deleteCampaignEmail(supabase, id);
    revalidatePath("/marketing/campanhas");
    return { ok: true, notice: "E-mail apagado da sequência." };
  } catch (error) {
    return { error: explain(error, "Não foi possível apagar o e-mail.") };
  }
}

// ---------------------------------------------------------------------------
// Agendar — o estado e a data; o disparo é P10-09
// ---------------------------------------------------------------------------

export async function agendarCampanha(input: unknown): Promise<CampaignActionResult> {
  const parsed = campaignScheduleSchema.safeParse(input);
  if (!parsed.success) return { error: "Escolha uma data de agendamento." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para agendar campanhas." };

  try {
    await scheduleCampaign(supabase, parsed.data.id, parsed.data.at);
    revalidatePath("/marketing/campanhas");
    // Diz o que acontece a seguir, e o que **não** acontece: o disparo é de
    // P10-09, e uma campanha agendada hoje não sai sozinha.
    return { ok: true, notice: "Campanha agendada. O envio automático entra com P10-09." };
  } catch (error) {
    return { error: explain(error, "Não foi possível agendar a campanha.") };
  }
}

export async function desagendarCampanha(id: unknown): Promise<CampaignActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para agendar campanhas." };

  try {
    await unscheduleCampaign(supabase, id);
    revalidatePath("/marketing/campanhas");
    return { ok: true, notice: "Campanha de volta a rascunho." };
  } catch (error) {
    return { error: explain(error, "Não foi possível desagendar a campanha.") };
  }
}

// ---------------------------------------------------------------------------
// O envio — a app pede, o worker entrega
// ---------------------------------------------------------------------------

/**
 * "Enviar" (04 §2.6).
 *
 * `campaign_send_now()` põe a campanha em `sending` e materializa o primeiro
 * e-mail da sequência **dentro do Postgres** (07 §24.6 #5): esta action nunca
 * vê um endereço. Quem entrega é o `mail-worker`, no ciclo seguinte — a app não
 * fala com SMTP (02 §3.3), e é isso que a mensagem de volta diz.
 */
export async function enviarCampanha(id: unknown): Promise<CampaignActionResult> {
  if (typeof id !== "string") return { error: "Pedido inválido." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para enviar campanhas." };

  try {
    const count = await sendCampaignNow(supabase, id);
    revalidatePath("/marketing/campanhas");
    return {
      ok: true,
      notice: `Campanha em envio: ${count} destinatário(s) na fila. O mail-worker entrega a partir de agora.`,
    };
  } catch (error) {
    return { error: explain(error, "Não foi possível enviar a campanha.") };
  }
}

/**
 * "Enviar teste" (04 §2.6) — pelo worker, e sem tocar nas métricas.
 *
 * O que vai no pedido é o **id** do e-mail da sequência e o endereço: o worker
 * lê o que está guardado. Mandar os blocos daqui fazia o teste provar uma coisa
 * e o envio fazer outra.
 */
export async function enviarTeste(input: unknown): Promise<CampaignActionResult> {
  const parsed = z
    .object({ campaignEmailId: z.string().uuid(), to: z.string().email("Endereço inválido.") })
    .safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pedido inválido." };
  }

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para enviar testes." };

  const workerUrl = process.env.MAIL_WORKER_URL;
  const workerToken = process.env.MAIL_WORKER_TOKEN;
  if (!workerUrl || !workerToken) {
    return { error: "O mail-worker ainda não está configurado (MAIL_WORKER_URL)." };
  }

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/campaign-test`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${workerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(45_000),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      return { error: body?.error ?? `O mail-worker respondeu ${response.status}.` };
    }

    return { ok: true, notice: `Teste enviado para ${parsed.data.to}.` };
  } catch {
    return { error: "Não foi possível falar com o mail-worker." };
  }
}

// ---------------------------------------------------------------------------
// A contagem da audiência (07 §24.6 #5: a contagem, e só a contagem)
// ---------------------------------------------------------------------------

export async function contarAudiencia(
  audience: unknown,
): Promise<{ count?: number; error?: string }> {
  if (
    typeof audience !== "string" ||
    !(CAMPAIGN_AUDIENCES as readonly string[]).includes(audience)
  ) {
    return { error: "Audiência inválida." };
  }

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para consultar audiências." };

  const count = await campaignAudienceCount(supabase, audience as CampaignAudience);
  // `null` é "não consegui perguntar" e não "não há ninguém" — zero é uma
  // resposta verdadeira e frequente enquanto o registo não recolher o
  // consentimento (D69).
  if (count === null) return { error: "Não foi possível contar a audiência." };
  return { count };
}

// ---------------------------------------------------------------------------
// A imagem de um bloco — bucket público, e é a razão de ser dele
// ---------------------------------------------------------------------------

export async function carregarImagem(
  formData: FormData,
): Promise<CampaignActionResult & { path?: string; url?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha uma imagem." };
  if (file.size > 5 * 1024 * 1024) return { error: "A imagem excede 5 MB." };

  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para carregar imagens." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMimeAllowed(bytes, ["image/png", "image/jpeg", "image/webp", "image/gif"]);
  if (!mime) return { error: "Só se aceitam imagens PNG, JPG, WebP e GIF." };

  // `{profile_id}/{uuid}.{ext}`: o primeiro segmento é quem carregou, e é o que
  // a policy de escrita do bucket lê (`20261015090000`).
  const path = `${user.id}/${randomUUID()}.${mime.extension}`;
  const { error } = await supabase.storage
    .from("campaign-assets")
    .upload(path, bytes, { contentType: mime.type, upsert: false });

  if (error) return { error: "Não foi possível carregar a imagem." };

  // Público, ao contrário de todos os outros buckets desta fase: um cliente de
  // e-mail abre a imagem **sem sessão**, meses depois (05 §1.4).
  const { data } = supabase.storage.from("campaign-assets").getPublicUrl(path);
  return { ok: true, path, url: data.publicUrl };
}

/** As assinaturas dos quatro formatos do bucket, e a extensão de cada um. */

// ---------------------------------------------------------------------------
// A pré-visualização e a exportação — o renderizador a sério
// ---------------------------------------------------------------------------

export type PreviewInput = {
  blocks: unknown;
  subject?: string;
  preheader?: string;
  background?: string;
  /** O "Com dados" de 04 §2.6. */
  withData?: boolean;
  /**
   * A tela do editor pede o mesmo HTML com os blocos marcados, para se poder
   * clicar neles. Ver `CampaignRenderContext.editing`: é o único sítio que o
   * liga, e o envio nunca passa por aqui.
   */
  editing?: boolean;
  selectedBlockId?: string | null;
};

export async function preverCampanha(
  input: PreviewInput,
): Promise<{ html?: string; error?: string }> {
  const supabase = await getMarketingClient();
  if (!supabase) return { error: "Sem permissão para pré-visualizar campanhas." };

  const parsed = campaignBlocksSchema.safeParse(input.blocks);
  const blocks: CampaignBlock[] = parsed.success ? parsed.data : [];
  if (blocks.length === 0) return { error: "Este e-mail ainda não tem blocos." };

  const t = await getTranslations("marketing.campaigns");

  // A assinatura da caixa escolhida no bloco, resolvida pela mesma função que o
  // composer usa (07 §24.6 #3: o Marketing lê as assinaturas, não as edita).
  const signatureBlock = blocks.find((block) => block.type === "signature");
  const signatureHtml =
    signatureBlock && signatureBlock.type === "signature" && signatureBlock.mailboxId
      ? await campaignSignatureHtml(supabase, signatureBlock.mailboxId)
      : "";

  const propertyBlock = blocks.find((block) => block.type === "property");
  const property =
    propertyBlock && propertyBlock.type === "property" && propertyBlock.propertyId
      ? await lerImovel(supabase, propertyBlock.propertyId)
      : null;

  const { data: bucket } = supabase.storage.from("campaign-assets").getPublicUrl("");
  const webUrl = process.env.WEB_URL ?? "";

  const html = await renderCampaignHtml(blocks, {
    // `getPublicUrl("")` devolve o prefixo com a barra final; o renderizador
    // junta `/${path}`, por isso tira-se.
    assetBaseUrl: bucket.publicUrl.replace(/\/$/, ""),
    // Um exemplo, e é visível que o é: o link verdadeiro leva o
    // `unsubscribe_token` do destinatário, que só existe quando a campanha é
    // materializada em `campaign_recipients` — no envio.
    unsubscribeUrl: `${webUrl}/cancelar-subscricao?t=exemplo`,
    signatureHtml,
    property,
    values: input.withData ? AMOSTRA : undefined,
    labels: { unsubscribe: t("unsubscribeLink") },
    preheader: input.preheader,
    background: input.background,
    editing: input.editing,
    selectedBlockId: input.selectedBlockId,
  });

  return { html };
}

/**
 * Os valores do "Com dados" (04 §2.6).
 *
 * São uma **amostra** e não um destinatário real: 07 §24.6 #5 não deixa o
 * Marketing ler a lista, e ir buscar "o primeiro da audiência" para pré-ver
 * era exatamente isso por outra porta. Nomes inventados e um plano que existe.
 */
const AMOSTRA = { nome: "Ana", apelido: "Martins", plano: "Premium" } as const;

/**
 * O imóvel em destaque, lido de `properties_public`.
 *
 * A view é o único caminho de leitura pública de `properties` (08 §2.7) e corre
 * com os direitos do dono — é o que permite ao Marketing lê-la sem lhe dar a
 * tabela. **Sem capa:** as fotografias vivem num bucket privado e um URL
 * assinado expira; ver a nota de `CampaignRenderContext.property`.
 */
async function lerImovel(
  supabase: Awaited<ReturnType<typeof getMarketingClient>>,
  propertyId: string,
) {
  if (!supabase) return null;

  const { data } = await supabase
    .from("properties_public")
    .select("id, title, city, deal, price_cents, rent_cents")
    .eq("id", propertyId)
    .maybeSingle();

  if (!data) return null;

  const cents = data.deal === "rent" ? data.rent_cents : data.price_cents;
  const price = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);

  return {
    title: data.title ?? "",
    location: data.city ?? "",
    price: data.deal === "rent" ? `${price}/mês` : price,
    /**
     * `/propriedades/{id}` e não o slug completo `titulo-em-kebab-{uuid}`: o slug
     * resolve-se pelo uuid do fim (`listingIdFromSlug`), e a ficha pública
     * **redireciona** para a forma canónica — que é a razão por que esse
     * redireccionamento existe. O helper que compõe o slug vive em `apps/web`
     * e importá-lo daqui era atar o painel interno ao site público para ganhar
     * um redireccionamento a menos.
     */
    url: `${process.env.WEB_URL ?? ""}/propriedades/${data.id}`,
  };
}
