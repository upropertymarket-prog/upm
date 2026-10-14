import { z } from "zod";

/**
 * Os blocos de uma campanha (P10-08 · 04 §2.6 · 02 §3.2)
 * =========================================================================
 * 02 §3.2 diz o essencial: *"estado em JSON de blocos → renderização com React
 * Email para HTML compatível com clientes de e-mail"*. Este ficheiro é o
 * **contrato** desse JSON, e é deliberadamente a primeira coisa a existir: o
 * construtor visual, o renderizador, a pré-visualização e o envio leem todos
 * daqui, e um deles a inventar um campo é um e-mail que sai diferente do que se
 * viu no ecrã.
 *
 * ## A lista de blocos é a de 04 §2.6, e nada mais
 *
 * Dez tipos: cabeçalho com logo, título, texto, imagem, botão, imóvel em
 * destaque, divisor, espaçador, assinatura e rodapé com cancelar subscrição.
 * Não há "bloco personalizado" nem HTML livre, e isso é uma escolha: um bloco
 * de HTML livre num construtor de campanhas é a porta por onde entra marcação
 * que nenhum cliente de e-mail desenha, e a promessa do construtor é
 * exatamente a oposta.
 *
 * ## O alinhamento vive em todos menos dois
 *
 * 04 §2.6: *"alinhar à esquerda/centro/direita (todos os blocos exceto divisor
 * e espaçador; no imóvel em destaque afeta o texto)"*. Está no tipo e não numa
 * verificação do ecrã — um divisor com alinhamento não é um erro de utilização,
 * é um estado que não devia poder existir.
 *
 * ## O rodapé de cancelar subscrição não é opcional
 *
 * 02 §4.3 (RGPD): *"link de cancelamento em todas as campanhas"*. `footer` é o
 * único bloco que o esquema **exige** — ver `campaignBlocksSchema` no fim. Uma
 * campanha sem ele não é uma campanha mal desenhada: é uma que não pode sair.
 */

export const BLOCK_ALIGNMENTS = ["left", "center", "right"] as const;
export type BlockAlignment = (typeof BLOCK_ALIGNMENTS)[number];

const alignment = z.enum(BLOCK_ALIGNMENTS).default("left");

/** Os dois que não têm alinhamento (04 §2.6). */
export const UNALIGNED_BLOCKS = ["divider", "spacer"] as const;

const base = { id: z.string().min(1) };

export const headerBlockSchema = z.object({
  ...base,
  type: z.literal("header"),
  align: alignment,
  /** Caminho no bucket das campanhas; vazio usa o wordmark em texto (D67). */
  logoPath: z.string().max(500).default(""),
  logoAlt: z.string().max(200).default("UProperty Market"),
});

export const headingBlockSchema = z.object({
  ...base,
  type: z.literal("heading"),
  align: alignment,
  text: z.string().max(300).default(""),
  /** `h1` no primeiro, `h2` nos seguintes — quem decide é o renderizador. */
  level: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const textBlockSchema = z.object({
  ...base,
  type: z.literal("text"),
  align: alignment,
  /** HTML do `RichText`, já sanitizado na gravação (02 §4.3). */
  html: z.string().max(20_000).default(""),
});

export const imageBlockSchema = z.object({
  ...base,
  type: z.literal("image"),
  align: alignment,
  path: z.string().max(500).default(""),
  /** Nunca opcional: um e-mail com imagens bloqueadas é o caso normal, não a
   *  exceção, e o `alt` é o que se lê nesse caso (04 §1.7). */
  alt: z.string().max(200).default(""),
  href: z.string().url().or(z.literal("")).default(""),
});

export const buttonBlockSchema = z.object({
  ...base,
  type: z.literal("button"),
  align: alignment,
  label: z.string().max(80).default(""),
  href: z.string().url().or(z.literal("")).default(""),
});

export const propertyBlockSchema = z.object({
  ...base,
  type: z.literal("property"),
  /** 04 §2.6: no imóvel em destaque o alinhamento afeta **o texto**. */
  align: alignment,
  propertyId: z.string().uuid().nullable().default(null),
});

export const dividerBlockSchema = z.object({ ...base, type: z.literal("divider") });

export const spacerBlockSchema = z.object({
  ...base,
  type: z.literal("spacer"),
  /** Em píxeis, porque é o que um cliente de e-mail entende. */
  height: z.number().int().min(4).max(96).default(24),
});

export const signatureBlockSchema = z.object({
  ...base,
  type: z.literal("signature"),
  align: alignment,
  /**
   * A assinatura **lê-se da caixa escolhida** e não se edita aqui: 07 §24.6 #3
   * é explícito — as assinaturas vivem no Suporte e o Marketing só as lê. Um
   * segundo editor divergiria do primeiro à primeira alteração.
   */
  mailboxId: z.string().uuid().nullable().default(null),
});

export const footerBlockSchema = z.object({
  ...base,
  type: z.literal("footer"),
  align: alignment,
  /** O texto legal; o link de cancelamento é do renderizador, não daqui. */
  text: z.string().max(1000).default(""),
});

export const campaignBlockSchema = z.discriminatedUnion("type", [
  headerBlockSchema,
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  propertyBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  signatureBlockSchema,
  footerBlockSchema,
]);

export type CampaignBlock = z.infer<typeof campaignBlockSchema>;
export type CampaignBlockType = CampaignBlock["type"];

export const CAMPAIGN_BLOCK_TYPES: CampaignBlockType[] = [
  "header",
  "heading",
  "text",
  "image",
  "button",
  "property",
  "divider",
  "spacer",
  "signature",
  "footer",
];

/**
 * A lista de blocos de um e-mail.
 *
 * Duas regras no esquema, e as duas existem porque um aviso no ecrã não as
 * garante:
 *
 * 1. **Tem de haver um `footer`** — é o link de cancelar subscrição que 02 §4.3
 *    exige em todas as campanhas. Sem ele a campanha não passa a validação, o
 *    que é diferente de "o ecrã avisa".
 * 2. **Os `id` são únicos.** São eles que o construtor usa para mover,
 *    duplicar e apagar; dois iguais e o "duplicar" passa a mexer nos dois.
 */
export const campaignBlocksSchema = z
  .array(campaignBlockSchema)
  .min(1, "Um e-mail precisa de pelo menos um bloco.")
  .max(60)
  .refine((blocks) => blocks.some((block) => block.type === "footer"), {
    message: "Falta o rodapé com o link de cancelar subscrição (RGPD, 02 §4.3).",
  })
  .refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, {
    message: "Dois blocos com o mesmo identificador.",
  });

/** As variáveis de 04 §2.6, e só estas. */
export const CAMPAIGN_VARIABLES = ["nome", "apelido", "plano"] as const;
export type CampaignVariable = (typeof CAMPAIGN_VARIABLES)[number];

/**
 * O contrato dos chips: `<span data-variable="nome">Nome</span>`
 * =========================================================================
 * O editor escreve isto, o renderizador substitui-o, e a pré-visualização "Com
 * dados" (04 §2.6) usa **a mesma função** que o envio. É o que garante que o
 * que se vê com dados é exatamente o que o destinatário recebe.
 *
 * Com `values` incompleto, a variável desconhecida fica **com o rótulo à
 * vista** em vez de desaparecer: um e-mail que sai com "Olá ," é pior do que um
 * que sai com "Olá {nome}," — o primeiro parece um defeito do produto, o
 * segundo denuncia-se a quem o escreveu.
 */
export function substituteCampaignVariables(
  html: string,
  values: Partial<Record<CampaignVariable, string>>,
): string {
  return html.replace(
    /<span[^>]*data-variable="([a-z]+)"[^>]*>(.*?)<\/span>/gi,
    (match, name: string, label: string) => {
      const value = values[name as CampaignVariable];
      return value ? escapeHtml(value) : label;
    },
  );
}

/** As variáveis que um HTML usa — para o ecrã poder dizer quais são. */
export function campaignVariablesIn(html: string): CampaignVariable[] {
  const found = new Set<CampaignVariable>();
  for (const match of html.matchAll(/data-variable="([a-z]+)"/gi)) {
    const name = match[1]!.toLowerCase();
    if ((CAMPAIGN_VARIABLES as readonly string[]).includes(name)) {
      found.add(name as CampaignVariable);
    }
  }
  return [...found];
}

/**
 * O valor substituído é **escapado**: vem de `profiles.full_name`, que é texto
 * que o próprio utilizador escreveu. Um nome com `<` partia a marcação do
 * e-mail de todos os destinatários dessa campanha.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
