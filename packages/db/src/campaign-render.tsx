import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

import {
  substituteCampaignVariables,
  type CampaignBlock,
  type CampaignVariable,
} from "./campaign-blocks";

/**
 * Blocos → HTML de e-mail (P10-08 · 02 §3.2)
 * =========================================================================
 * 02 §3.2: *"renderização com React Email para HTML compatível com clientes de
 * e-mail"*. O React Email existe por uma razão aborrecida e real: o Gmail
 * remove o `<style>` do cabeçalho, o Outlook do Windows renderiza com o motor
 * do Word e não entende `flex` nem `grid`, e metade dos clientes ignora
 * `max-width`. Escrever tabelas e estilos em linha à mão é possível — o
 * `templates.ts` do worker faz isso para as notificações transacionais, que são
 * sempre o mesmo e-mail — mas uma campanha é composta por blocos que o
 * marketing arrasta, e aí a conta de casos passa a não caber na cabeça de
 * ninguém.
 *
 * ## As cores estão em hexadecimal, e é a segunda exceção documentada
 *
 * 04 §5.1 proíbe cores fixas. A primeira exceção viva é a folha dentro do
 * `iframe` do leitor de e-mail; esta é a segunda, e pela mesma razão: **um
 * cliente de e-mail não tem as `custom properties` do design system**. Os
 * valores são os tokens do tema claro, copiados com o nome do token ao lado
 * para se saber de onde vieram quando a paleta mudar — exatamente como o
 * `templates.ts` já faz.
 *
 * ## O rodapé é a única coisa que o renderizador acrescenta
 *
 * O bloco `footer` traz o texto legal; o **link de cancelar subscrição** é
 * posto aqui, com o `token` do destinatário. Não vem do construtor de
 * propósito: 02 §4.3 exige-o em todas as campanhas, e deixá-lo editável era
 * deixá-lo apagável.
 */

// Tokens do tema claro (packages/ui/src/styles/tokens.css).
const ACCENT = "#ff6a00"; // --accent
const TEXT = "#14161a"; // --text
const MUTED = "#5d6470"; // --muted
const BORDER = "#e4e7ec"; // --border
const SURFACE = "#ffffff"; // --surface
const BACKGROUND = "#f6f7f9"; // --bg

export type CampaignRenderContext = {
  /** O URL público que serve as imagens dos blocos (bucket das campanhas). */
  assetBaseUrl: string;
  /** O URL de cancelar subscrição, já com o token do destinatário. */
  unsubscribeUrl: string;
  /** A assinatura da caixa escolhida, já resolvida (05 §1.8). */
  signatureHtml?: string;
  /**
   * O imóvel em destaque, já lido — o renderizador não fala com a base de dados.
   *
   * `imageUrl` é **opcional**, e a razão é concreta: as fotografias dos imóveis
   * vivem no bucket `property-media`, que é **privado**, e um URL assinado
   * expira numa hora — exatamente o retângulo partido que levou o bucket das
   * campanhas a ser público (05 §1.4). A capa de um imóvel só pode ir num
   * e-mail depois de ser **copiada** para `campaign-assets`, e essa cópia exige
   * a `service_role`: é trabalho do `mail-worker`, no envio. Até lá o cartão
   * desenha-se sem foto — com título, localização, preço e ligação — em vez de
   * desenhar uma imagem que não abre.
   */
  property?: {
    title: string;
    price: string;
    location: string;
    imageUrl?: string;
    url: string;
  } | null;
  /** Com valores, as variáveis saem substituídas; sem eles, ficam os rótulos. */
  values?: Partial<Record<CampaignVariable, string>>;
  /** Texto do link de cancelar subscrição e do pré-cabeçalho. */
  labels: { unsubscribe: string };
  preheader?: string;
  /**
   * O fundo do e-mail — `campaigns.email_bg` (05 §1.9), o painel "Estilo" de
   * 04 §2.6. Hexadecimal e não token: terceira exceção viva a 04 §5.1, pela
   * mesma razão das outras duas — um cliente de e-mail não tem as `custom
   * properties` do design system.
   */
  background?: string;
  /**
   * A tela do editor — e a razão por que o `BlockCanvas` deixou de existir.
   * =========================================================================
   * Com `editing`, cada bloco sai embrulhado num `<div data-block-id>` e o
   * selecionado leva `data-selected`. Mais nada muda: é o **mesmo** HTML, pelo
   * **mesmo** renderizador, com um atributo a dizer onde começa cada bloco.
   *
   * É isto que resolve a tensão que o `BlockCanvas` tinha escrita na nota de
   * topo. Ele recusava imitar o e-mail porque "uma imitação é um segundo
   * renderizador, e divergia do primeiro à primeira alteração" — e tinha razão.
   * A saída não é imitar melhor: é **clicar no verdadeiro**. O editor mostra o
   * que o destinatário vai receber porque é literalmente o que o envio produz.
   *
   * **Nunca entra num envio.** Só a pré-visualização o liga; o `mail-worker`
   * chama `renderCampaignHtml` sem contexto de edição, e o
   * `campaign-render.test.ts` prende essa promessa.
   */
  editing?: boolean;
  /** O bloco com o cursor, para a tela o contornar. Só conta com `editing`. */
  selectedBlockId?: string | null;
};

const ALIGN_STYLE = (align?: string) => ({ textAlign: (align ?? "left") as "left" });

/**
 * Um bloco. Cada `case` é curto de propósito — o que não é curto é a razão por
 * que o e-mail tem de ser feito de tabelas, e essa está na nota de topo.
 */
function Block({ block, context }: { block: CampaignBlock; context: CampaignRenderContext }) {
  switch (block.type) {
    case "header":
      return (
        <Section style={{ padding: "0 0 24px", ...ALIGN_STYLE(block.align) }}>
          {block.logoPath ? (
            <Img
              src={`${context.assetBaseUrl}/${block.logoPath}`}
              alt={block.logoAlt}
              width="140"
              style={{ display: "inline-block" }}
            />
          ) : (
            // Sem logótipo em PNG (D67), a marca vai em texto — a mesma decisão
            // das assinaturas, e pela mesma razão: nenhum caminho inventado.
            <Text
              style={{
                margin: 0,
                fontSize: "17px",
                fontWeight: 800,
                color: ACCENT,
              }}
            >
              UProperty Market
            </Text>
          )}
        </Section>
      );

    case "heading":
      return (
        <Text
          style={{
            margin: "0 0 12px",
            fontSize: block.level === 1 ? "24px" : "19px",
            lineHeight: 1.3,
            fontWeight: 700,
            color: TEXT,
            ...ALIGN_STYLE(block.align),
          }}
        >
          {substitute(block.text, context)}
        </Text>
      );

    case "text":
      return (
        <Section style={ALIGN_STYLE(block.align)}>
          {/* O HTML vem do `RichText` e foi sanitizado na gravação (02 §4.3).
              Aqui entra como marcação porque é isso que ele é — e o React Email
              não tem um componente de HTML arbitrário.
              html-ok: sanitizado na escrita em `packages/db/src/campaigns.ts`,
              com allowlist. */}
          <div
            style={{ fontSize: "15px", lineHeight: 1.6, color: TEXT }}
            dangerouslySetInnerHTML={{ __html: substitute(block.html, context) }}
          />
        </Section>
      );

    case "image":
      return (
        <Section style={{ padding: "8px 0", ...ALIGN_STYLE(block.align) }}>
          {wrapLink(
            <Img
              src={`${context.assetBaseUrl}/${block.path}`}
              alt={block.alt}
              style={{ maxWidth: "100%", display: "inline-block", borderRadius: "8px" }}
            />,
            block.href,
          )}
        </Section>
      );

    case "button":
      return (
        <Section style={{ padding: "12px 0", ...ALIGN_STYLE(block.align) }}>
          <Button
            href={block.href || "#"}
            style={{
              backgroundColor: ACCENT,
              color: SURFACE,
              padding: "12px 22px",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {substitute(block.label, context)}
          </Button>
        </Section>
      );

    case "property":
      // Sem imóvel resolvido, o bloco **desaparece** em vez de desenhar uma
      // moldura vazia: um cartão sem preço nem foto num e-mail de marketing
      // lê-se como um erro do remetente.
      if (!context.property) return null;
      return (
        <Section
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: "10px",
            overflow: "hidden",
            margin: "12px 0",
          }}
        >
          {context.property.imageUrl ? (
            <Img
              src={context.property.imageUrl}
              alt={context.property.title}
              style={{ width: "100%", display: "block" }}
            />
          ) : null}
          <Section style={{ padding: "16px", ...ALIGN_STYLE(block.align) }}>
            <Text style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: TEXT }}>
              {context.property.title}
            </Text>
            <Text style={{ margin: "4px 0 0", fontSize: "14px", color: MUTED }}>
              {context.property.location}
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: "18px", fontWeight: 800, color: ACCENT }}>
              {context.property.price}
            </Text>
            <Link
              href={context.property.url}
              style={{ fontSize: "14px", color: ACCENT, textDecoration: "underline" }}
            >
              {context.property.title}
            </Link>
          </Section>
        </Section>
      );

    case "divider":
      return <Hr style={{ borderColor: BORDER, margin: "20px 0" }} />;

    case "spacer":
      return <Section style={{ height: `${block.height}px` }} />;

    case "signature":
      if (!context.signatureHtml) return null;
      return (
        <Section style={{ padding: "16px 0 0", ...ALIGN_STYLE(block.align) }}>
          {/* html-ok: a assinatura é sanitizada na escrita por
              `packages/db/src/signatures.ts`, que tem a política explícita das
              20 tags — sem `script`, sem `style`, sem iframes. */}
          <div
            style={{ fontSize: "13px", lineHeight: 1.5, color: TEXT }}
            dangerouslySetInnerHTML={{ __html: context.signatureHtml }}
          />
        </Section>
      );

    case "footer":
      return (
        <Section style={{ padding: "24px 0 0", ...ALIGN_STYLE(block.align) }}>
          <Hr style={{ borderColor: BORDER, margin: "0 0 16px" }} />
          {block.text ? (
            <Text style={{ margin: "0 0 8px", fontSize: "13px", lineHeight: 1.5, color: MUTED }}>
              {substitute(block.text, context)}
            </Text>
          ) : null}
          {/* O link que 02 §4.3 exige. Posto aqui e não no construtor: deixá-lo
              editável era deixá-lo apagável. */}
          <Link
            href={context.unsubscribeUrl}
            style={{ fontSize: "13px", color: MUTED, textDecoration: "underline" }}
          >
            {context.labels.unsubscribe}
          </Link>
        </Section>
      );
  }
}

function wrapLink(node: React.ReactElement, href: string) {
  return href ? <Link href={href}>{node}</Link> : node;
}

function substitute(value: string, context: CampaignRenderContext): string {
  return substituteCampaignVariables(value, context.values ?? {});
}

export function CampaignEmail({
  blocks,
  context,
}: {
  blocks: CampaignBlock[];
  context: CampaignRenderContext;
}) {
  return (
    <Html lang="pt">
      <Head>
        {/* Só na tela do editor. Um e-mail a sério não leva folha de estilos
            (metade dos clientes de correio deita-a fora), e é por isso que
            tudo o resto neste ficheiro é estilo em linha — esta é a única
            excepção, e existe porque nunca sai daqui. */}
        {context.editing ? (
          // html-ok: folha de estilos escrita neste ficheiro, só para a tela do
          // editor. Não leva nada de fora e nunca sai num e-mail.
          <style
            dangerouslySetInnerHTML={{
              __html: `
                [data-block-id] { position: relative; cursor: pointer; }
                [data-block-id]::after {
                  content: ""; position: absolute; inset: -4px;
                  border: 2px solid transparent; border-radius: 6px;
                  pointer-events: none; transition: border-color .12s;
                }
                [data-block-id]:hover::after { border-color: #f9bfa0; }
                [data-block-id][data-selected]::after { border-color: #ea580c; }
              `,
            }}
          />
        ) : null}
      </Head>
      {/* O pré-cabeçalho: a linha que o cliente de correio mostra ao lado do
          assunto. Sem ele, o Gmail mostra o início do primeiro bloco — que é
          quase sempre o logótipo, logo nada. */}
      {context.preheader ? <Preview>{context.preheader}</Preview> : null}
      <Body
        style={{
          margin: 0,
          padding: "24px 0",
          backgroundColor: context.background || BACKGROUND,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "28px",
            backgroundColor: SURFACE,
            borderRadius: "12px",
          }}
        >
          {blocks.map((block) =>
            context.editing ? (
              // O embrulho da tela. `display: block` e sem margem para não
              // mexer no espaçamento que o bloco já traz: o que o editor mostra
              // tem de ser medida a medida o que sai no envio, senão a tela
              // volta a ser uma aproximação — que é o que não queremos.
              <div
                key={block.id}
                data-block-id={block.id}
                data-selected={block.id === context.selectedBlockId ? "true" : undefined}
              >
                <Block block={block} context={context} />
              </div>
            ) : (
              <Block key={block.id} block={block} context={context} />
            ),
          )}
        </Container>
      </Body>
    </Html>
  );
}

/** O HTML que vai no e-mail. */
export async function renderCampaignHtml(
  blocks: CampaignBlock[],
  context: CampaignRenderContext,
): Promise<string> {
  return render(<CampaignEmail blocks={blocks} context={context} />);
}

/**
 * A versão em texto, que o Resend envia a par do HTML.
 *
 * Não é o `htmlToText` do Composer: aqui há a estrutura dos blocos à mão, e um
 * botão em texto simples tem de dizer para onde vai — `Ver imóveis
 * (https://…)`. Converter o HTML renderizado perdia isso.
 */
export function renderCampaignText(
  blocks: CampaignBlock[],
  context: CampaignRenderContext,
): string {
  const lines: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        lines.push(substitute(block.text, context), "");
        break;
      case "text":
        lines.push(stripTags(substitute(block.html, context)), "");
        break;
      case "button":
        if (block.label) {
          lines.push(
            `${substitute(block.label, context)}${block.href ? ` (${block.href})` : ""}`,
            "",
          );
        }
        break;
      case "image":
        if (block.alt) lines.push(`[${block.alt}]`, "");
        break;
      case "property":
        if (context.property) {
          lines.push(
            context.property.title,
            `${context.property.location} · ${context.property.price}`,
            context.property.url,
            "",
          );
        }
        break;
      case "divider":
        lines.push("---", "");
        break;
      case "signature":
        if (context.signatureHtml) lines.push(stripTags(context.signatureHtml), "");
        break;
      case "footer":
        if (block.text) lines.push(substitute(block.text, context));
        lines.push(`${context.labels.unsubscribe}: ${context.unsubscribeUrl}`);
        break;
      // O cabeçalho e o espaçador não têm texto que valha uma linha.
      case "header":
      case "spacer":
        break;
    }
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}
