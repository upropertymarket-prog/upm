"use client";

import { useRef } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Input, Select, Textarea } from "@upm/ui";
import { RichText, richTextLabels } from "@upm/ui/editor";
import {
  BLOCK_ALIGNMENTS,
  blockHasAlignment,
  CAMPAIGN_VARIABLES,
  newBlockId,
  type BlockAlignment,
  type CampaignBlock,
} from "@upm/db/campaign-blocks";
import type { CampaignSender } from "@upm/db/campaigns";

import type { CampaignActionResult } from "./actions";

/**
 * O canvas dos blocos (P10-08 · 04 §2.6)
 * =========================================================================
 * **É uma superfície de edição e não uma pré-visualização**, e a diferença é
 * deliberada. 04 §2.6 pede as duas coisas — "canvas" e "pré-visualização
 * computador/telemóvel" — e são peças diferentes: aqui cada bloco mostra os
 * seus campos para se poderem escrever; a pré-visualização mostra o e-mail
 * renderizado pelo **mesmo** `renderCampaignHtml` que o envio usa, dentro de um
 * `iframe`.
 *
 * A alternativa era desenhar aqui uma imitação do e-mail e deixar clicar nela.
 * Rejeitada por uma razão que já custou noutros sítios deste projeto: uma
 * imitação é um segundo renderizador, e divergia do primeiro à primeira
 * alteração. O que o Marketing vê como "assim vai sair" é sempre o renderizador
 * a sério.
 *
 * ## O rodapé não se apaga nem se duplica
 *
 * 02 §4.3 exige o link de cancelar subscrição em todas as campanhas, e o
 * `campaignBlocksSchema` recusa uma lista sem ele — tal como a função
 * `security definer`. O botão de apagar está **desativado** no rodapé, com a
 * razão no `title`: um botão que falha ao ser clicado ensina a regra pelo erro.
 * Duplicá-lo dava dois links de cancelamento no mesmo e-mail.
 */

export type BlockCanvasProps = {
  blocks: CampaignBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (blocks: CampaignBlock[]) => void;
  /** As caixas, para o bloco da assinatura (07 §24.6 #3: lê, não edita). */
  senders: CampaignSender[];
  properties: { id: string; label: string }[];
  onUploadImage: (
    formData: FormData,
  ) => Promise<CampaignActionResult & { path?: string; url?: string }>;
  disabled?: boolean;
};

export function BlockCanvas(props: BlockCanvasProps) {
  const t = useTranslations("marketing.campaigns");
  const tRoot = useTranslations();

  function replace(index: number, block: CampaignBlock) {
    const next = [...props.blocks];
    next[index] = block;
    props.onChange(next);
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    if (to < 0 || to >= props.blocks.length) return;
    const next = [...props.blocks];
    const [block] = next.splice(index, 1);
    next.splice(to, 0, block!);
    props.onChange(next);
  }

  function duplicate(index: number) {
    const block = props.blocks[index]!;
    // Um `id` novo, sempre: dois iguais e o "duplicar" passava a mexer nos dois
    // (é a segunda regra de `campaignBlocksSchema`).
    const copy = { ...block, id: newBlockId() } as CampaignBlock;
    const next = [...props.blocks];
    next.splice(index + 1, 0, copy);
    props.onChange(next);
    props.onSelect(copy.id);
  }

  function remove(index: number) {
    props.onChange(props.blocks.filter((_, at) => at !== index));
  }

  if (props.blocks.length === 0) {
    return (
      <div
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
        {t("canvasEmpty")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-3)" }}>
      {props.blocks.map((block, index) => {
        const selected = block.id === props.selectedId;
        const isFooter = block.type === "footer";

        return (
          <article
            key={block.id}
            aria-label={t(`blocks.${block.type}`)}
            onClick={() => props.onSelect(block.id)}
            style={{
              display: "grid",
              gap: "var(--sp-3)",
              padding: "var(--sp-4)",
              borderRadius: "var(--r-lg)",
              background: "var(--surface)",
              // "Bloco selecionado com contorno cinzento-claro" (04 §2.6): é
              // cinzento e não o acento de propósito — o acento é das ações, e
              // aqui o que se marca é só onde está o cursor.
              border: `1px solid ${selected ? "var(--border2)" : "var(--border)"}`,
              outline: selected ? "2px solid var(--border2)" : "none",
              outlineOffset: "1px",
            }}
          >
            <header
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--sp-2)",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
                {t(`blocks.${block.type}`)}
              </span>

              {/* A barra do bloco selecionado — neutra, como 04 §2.6 pede. */}
              {selected ? (
                <div
                  role="toolbar"
                  aria-label={t("blockToolbar")}
                  style={{ display: "flex", flexWrap: "wrap", gap: "2px", alignItems: "center" }}
                >
                  {/* O alinhamento não existe no divisor nem no espaçador, e
                      isso está no tipo e não aqui (ver `campaign-blocks.ts`). */}
                  {blockHasAlignment(block.type)
                    ? BLOCK_ALIGNMENTS.map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant="ghost"
                          iconOnly
                          disabled={props.disabled}
                          aria-label={t(`align.${align}`)}
                          title={t(`align.${align}`)}
                          aria-pressed={"align" in block && block.align === align}
                          onClick={() => replace(index, { ...block, align } as CampaignBlock)}
                        >
                          <AlignIcon align={align} />
                        </Button>
                      ))
                    : null}

                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    disabled={props.disabled || index === 0}
                    aria-label={t("blockUp")}
                    title={t("blockUp")}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    disabled={props.disabled || index === props.blocks.length - 1}
                    aria-label={t("blockDown")}
                    title={t("blockDown")}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    // Dois rodapés eram dois links de cancelar subscrição.
                    disabled={props.disabled || isFooter}
                    aria-label={t("blockDuplicate")}
                    title={isFooter ? t("footerLocked") : t("blockDuplicate")}
                    onClick={() => duplicate(index)}
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    disabled={props.disabled || isFooter}
                    aria-label={t("blockDelete")}
                    title={isFooter ? t("footerLocked") : t("blockDelete")}
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : null}
            </header>

            <BlockEditor
              block={block}
              onChange={(next) => replace(index, next)}
              senders={props.senders}
              properties={props.properties}
              onUploadImage={props.onUploadImage}
              disabled={props.disabled}
              labels={{
                t: (key, values) => t(key, values),
                richText: richTextLabels(tRoot),
              }}
            />
          </article>
        );
      })}
    </div>
  );
}

function AlignIcon({ align }: { align: BlockAlignment }) {
  if (align === "center") return <AlignCenter size={14} />;
  if (align === "right") return <AlignRight size={14} />;
  return <AlignLeft size={14} />;
}

type EditorLabels = {
  t: (key: string, values?: Record<string, string | number>) => string;
  richText: ReturnType<typeof richTextLabels>;
};

/**
 * Os campos de cada bloco.
 *
 * Um `switch` e não dez componentes exportados: cada caso são duas ou três
 * entradas, e dez ficheiros para isso era procurar num sítio o que se lê de
 * uma vez. O que é longo é a razão de cada decisão, e essa fica junto ao caso
 * que a tem.
 */
function BlockEditor({
  block,
  onChange,
  senders,
  properties,
  onUploadImage,
  disabled,
  labels,
}: {
  block: CampaignBlock;
  onChange: (block: CampaignBlock) => void;
  senders: CampaignSender[];
  properties: { id: string; label: string }[];
  onUploadImage: BlockCanvasProps["onUploadImage"];
  disabled?: boolean;
  labels: EditorLabels;
}) {
  const { t } = labels;

  switch (block.type) {
    case "header":
      return (
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <ImageField
            path={block.logoPath}
            onPath={(logoPath) => onChange({ ...block, logoPath })}
            onUploadImage={onUploadImage}
            disabled={disabled}
            labels={labels}
          />
          <Input
            label={t("logoAltLabel")}
            value={block.logoAlt}
            maxLength={200}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, logoAlt: event.target.value })}
          />
          {/* D67: os logótipos do projeto são SVG, que os clientes de correio
              não desenham, e não há PNG nem URL público. Sem imagem, o
              renderizador põe a marca em texto — e o ecrã di-lo antes de
              alguém procurar o ficheiro. */}
          {!block.logoPath ? <Note>{t("logoFallbackNote")}</Note> : null}
        </div>
      );

    case "heading":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: "var(--sp-3)",
          }}
        >
          <Input
            label={t("headingLabel")}
            value={block.text}
            maxLength={300}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
          <Select
            label={t("headingLevelLabel")}
            value={String(block.level)}
            disabled={disabled}
            options={[
              { value: "1", label: t("headingLevel.1") },
              { value: "2", label: t("headingLevel.2") },
            ]}
            onChange={(event) => onChange({ ...block, level: event.target.value === "2" ? 2 : 1 })}
          />
        </div>
      );

    case "text":
      return (
        <RichText
          label={t("blocks.text")}
          value={block.html}
          onChange={(html) => onChange({ ...block, html })}
          labels={labels.richText}
          // As variáveis como chips (04 §2.6). A lista é a de
          // `CAMPAIGN_VARIABLES` e o rótulo vem das traduções — o editor
          // partilhado não conhece lista nenhuma, recebe-a de quem o monta.
          variables={CAMPAIGN_VARIABLES.map((name) => ({
            name,
            label: t(`variables.${name}`),
          }))}
          // O `id` do bloco: trocar de e-mail na sequência repõe o conteúdo, e
          // escrever no mesmo não mexe no cursor.
          resetKey={block.id}
          disabled={disabled}
          minHeight={160}
        />
      );

    case "image":
      return (
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <ImageField
            path={block.path}
            onPath={(path) => onChange({ ...block, path })}
            onUploadImage={onUploadImage}
            disabled={disabled}
            labels={labels}
          />
          <Input
            label={t("imageAltLabel")}
            // Nunca opcional: num e-mail, as imagens bloqueadas são o caso
            // normal e o `alt` é o que se lê nesse caso (04 §1.7).
            hint={t("imageAltHint")}
            value={block.alt}
            maxLength={200}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, alt: event.target.value })}
          />
          <Input
            label={t("linkLabel")}
            type="url"
            placeholder="https://"
            value={block.href}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, href: event.target.value })}
          />
        </div>
      );

    case "button":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            gap: "var(--sp-3)",
          }}
        >
          <Input
            label={t("buttonLabel")}
            value={block.label}
            maxLength={80}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, label: event.target.value })}
          />
          <Input
            label={t("linkLabel")}
            type="url"
            placeholder="https://"
            value={block.href}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, href: event.target.value })}
          />
        </div>
      );

    case "property":
      return (
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <Select
            label={t("propertyLabel")}
            value={block.propertyId ?? ""}
            disabled={disabled}
            options={[
              { value: "", label: t("propertyNone") },
              ...properties.map((property) => ({ value: property.id, label: property.label })),
            ]}
            onChange={(event) => onChange({ ...block, propertyId: event.target.value || null })}
          />
          {/* A fotografia do imóvel vive num bucket privado e um URL assinado
              expira: a capa só pode ir no e-mail depois de ser copiada para
              `campaign-assets`, e essa cópia é do `mail-worker`, no envio. O
              cartão desenha-se sem foto em vez de desenhar uma que não abre —
              ver a nota de `CampaignRenderContext.property`. */}
          <Note>{t("propertyPhotoNote")}</Note>
        </div>
      );

    case "divider":
      return <Note>{t("dividerNote")}</Note>;

    case "spacer":
      return (
        <Input
          label={t("spacerLabel")}
          type="number"
          min={4}
          max={96}
          step={4}
          value={String(block.height)}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...block, height: clamp(Number(event.target.value), 4, 96) })
          }
        />
      );

    case "signature":
      return (
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <Select
            label={t("signatureMailboxLabel")}
            value={block.mailboxId ?? ""}
            disabled={disabled}
            options={[
              { value: "", label: t("signatureNone") },
              ...senders.map((sender) => ({
                value: sender.id,
                label: sender.displayName
                  ? `${sender.displayName} · ${sender.address}`
                  : sender.address,
              })),
            ]}
            onChange={(event) => onChange({ ...block, mailboxId: event.target.value || null })}
          />
          {/* 07 §24.6 #3: as assinaturas vivem no Suporte e o Marketing só as
              lê. Um segundo editor divergia do primeiro à primeira alteração. */}
          <Note>{t("signatureReadOnlyNote")}</Note>
        </div>
      );

    case "footer":
      return (
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <Textarea
            label={t("footerLabel")}
            hint={t("footerHint")}
            rows={3}
            value={block.text}
            maxLength={1000}
            disabled={disabled}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
          {/* O link de cancelamento é posto pelo renderizador, com o token do
              destinatário. Não vem daqui de propósito: 02 §4.3 exige-o em
              todas as campanhas, e deixá-lo editável era deixá-lo apagável. */}
          <Note>{t("footerUnsubscribeNote")}</Note>
        </div>
      );
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** A nota de um bloco: diz o que o bloco faz quando não é óbvio pelos campos. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--muted)" }}>
      {children}
    </p>
  );
}

/**
 * O campo de imagem, partilhado pelo cabeçalho e pelo bloco de imagem.
 *
 * A imagem sobe assim que é escolhida e o que fica no bloco é o **caminho** —
 * como nas Atualizações, e pela mesma razão: o `alt` só faz sentido depois de
 * haver imagem, e um upload diferido obrigava a gravar duas vezes para a poder
 * descrever. O bucket é público (05 §1.4), por isso dá-se logo o URL a ver.
 */
function ImageField({
  path,
  onPath,
  onUploadImage,
  disabled,
  labels,
}: {
  path: string;
  onPath: (path: string) => void;
  onUploadImage: BlockCanvasProps["onUploadImage"];
  disabled?: boolean;
  labels: EditorLabels;
}) {
  const { t } = labels;
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "grid", gap: "var(--sp-2)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--sp-3)" }}>
        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const form = new FormData();
            form.set("file", file);
            const result = await onUploadImage(form);
            if (result.path) onPath(result.path);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<ImagePlus size={14} />}
          disabled={disabled}
          onClick={() => picker.current?.click()}
        >
          {path ? t("imageReplace") : t("imageChoose")}
        </Button>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          {path || t("imageNone")}
        </span>
        {path && !disabled ? (
          <Button size="sm" variant="ghost" onClick={() => onPath("")}>
            {t("imageRemove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
