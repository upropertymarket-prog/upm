"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatusTag,
  Toggle,
  useToast,
  type StatusTone,
} from "@upm/ui";
import { RichText, richTextLabels } from "@upm/ui/editor";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_GROUPS,
  templatePreview,
  type MessageTemplateRow,
  type TemplateCategory,
  type TemplateSaveInput,
} from "@upm/db/message-templates";

import type { TemplateActionResult } from "./actions";

/**
 * Modelos de e-mail — `/marketing/modelos` (21 out 2026)
 * =========================================================================
 * O ecrã onde o Marketing escreve o texto que toda a equipa usa para responder.
 *
 * ## Cartões e não tabela
 *
 * Ao contrário do SEO e das caixas de e-mail, que são listas de registos com
 * campos a comparar, aqui o que se procura é **texto**: quem abre este ecrã
 * está à procura do modelo certo, e reconhece-o pelo princípio do corpo. Um
 * cartão mostra o assunto e as primeiras linhas; uma linha de tabela não
 * mostra nenhum dos dois sem ficar ilegível.
 *
 * ## Filtrar por categoria, e só por categoria
 *
 * A referência que deu a ideia filtrava também por canal — E-mail, WhatsApp,
 * SMS. Nós só temos e-mail, por decisão do cliente, e um seletor com uma opção
 * é um seletor que mente sobre o que o produto faz.
 *
 * ## Inativo em vez de apagado
 *
 * O interruptor de cada cartão tira o modelo do compositor e deixa-o na lista.
 * É o gesto normal: um modelo que deixou de servir esta época pode servir a
 * seguir, e um modelo apagado deixa os e-mails que o usaram sem explicação
 * para o texto que levam. Apagar existe para o que nunca devia ter sido
 * escrito — e por isso pergunta primeiro.
 *
 * ## As variáveis não se resolvem aqui
 *
 * O chip guarda `{{nome}}` e é assim que vai para a base de dados. Quem tem o
 * contexto — a que pessoa se escreve, sobre que imóvel — é quem insere o modelo
 * no compositor, e esse contexto não existe no momento em que o modelo se
 * grava. É também por isso que **o rótulo do chip não se traduz**: conta o
 * label guardado quando a variável foi inserida, como nos contratos.
 */

export type TemplateManagerProps = {
  templates: MessageTemplateRow[];
  /** `false` para o Suporte, que lê os modelos mas não lhes mexe. */
  canWrite: boolean;
  locale: string;
  onSave: (input: TemplateSaveInput) => Promise<TemplateActionResult>;
  onDelete: (id: string) => Promise<TemplateActionResult>;
};

type Draft = {
  id?: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
};

const EMPTY: Draft = {
  name: "",
  category: "support",
  subject: "",
  bodyHtml: "",
  isActive: true,
};

/** Tons da família genérica de ciclo de vida (04 §5.6), não cores novas. */
const CATEGORY_TONE: Record<TemplateCategory, StatusTone> = {
  lead: "new",
  property: "active",
  visit: "pending",
  contract: "archived",
  billing: "draft",
  support: "draft",
};

export function TemplateManager(props: TemplateManagerProps) {
  const t = useTranslations("marketing.templates");
  const tCommon = useTranslations("common");
  /** O da raiz: o `richTextLabels` lê `editor.*`, que é um namespace de topo. */
  const tRoot = useTranslations();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [filter, setFilter] = useState<TemplateCategory | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<TemplateActionResult>({});

  const visible = useMemo(
    () =>
      filter === "all" ? props.templates : props.templates.filter((r) => r.category === filter),
    [props.templates, filter],
  );

  /** Os chips que o editor oferece — ver a nota de topo sobre o rótulo. */
  const variables = useMemo(
    () => TEMPLATE_VARIABLES.map((v) => ({ name: v.key, label: t(`variables.${v.key}`) })),
    [t],
  );

  function guardar() {
    if (!draft) return;
    startTransition(async () => {
      const outcome = await props.onSave({
        id: draft.id,
        name: draft.name,
        category: draft.category,
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        isActive: draft.isActive,
      });
      setResult(outcome);
      if (outcome.error) return;
      if (outcome.notice) toast(outcome.notice, "success");
      else toast(t("saved"), "success");
      setDraft(null);
    });
  }

  function alternarAtivo(row: MessageTemplateRow) {
    startTransition(async () => {
      const outcome = await props.onSave({
        id: row.id,
        name: row.name,
        category: row.category,
        subject: row.subject,
        bodyHtml: row.body_html,
        isActive: !row.is_active,
      });
      if (outcome.error) toast(outcome.error, "error");
    });
  }

  function apagar(row: MessageTemplateRow) {
    // Apagar não se desfaz, e um modelo apagado leva com ele a explicação do
    // texto que já saiu. A confirmação é por isso, e não por cautela genérica.
    if (!window.confirm(t("deleteConfirm", { name: row.name }))) return;
    startTransition(async () => {
      const outcome = await props.onDelete(row.id);
      if (outcome.error) toast(outcome.error, "error");
      else toast(t("deleted"), "success");
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: props.templates.length })}
        actions={
          props.canWrite ? (
            <Button
              leadingIcon={<Plus size={15} />}
              disabled={pending}
              onClick={() => {
                setDraft({ ...EMPTY });
                setResult({});
              }}
            >
              {t("new")}
            </Button>
          ) : null
        }
      />

      {/* O filtro. `role="tablist"` porque é o que isto é para quem navega por
          teclado: vistas da mesma lista, não navegação. */}
      <div
        role="tablist"
        aria-label={t("filterLabel")}
        style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}
      >
        {(["all", ...TEMPLATE_CATEGORIES] as const).map((key) => {
          const active = filter === key;
          return (
            <Button
              key={key}
              size="sm"
              variant={active ? "secondary" : "ghost"}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(key)}
            >
              {key === "all" ? t("filterAll") : t(`categories.${key}`)}
            </Button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={props.templates.length === 0 ? t("empty") : t("emptyFilter")}
          description={props.templates.length === 0 ? t("emptyHint") : undefined}
        />
      ) : (
        <div
          style={{
            display: "grid",
            // Intrínseca, sem media queries: três cartões quando cabem, um
            // quando não. É a regra do projeto para grelhas.
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: "var(--sp-5)",
            alignItems: "start",
          }}
        >
          {visible.map((row) => (
            <Card
              key={row.id}
              padded
              style={{
                display: "grid",
                gap: "var(--sp-3)",
                // Um modelo inativo lê-se como inativo, e não só pela etiqueta:
                // o cartão inteiro recua. 04 §1.6 pede que o estado nunca
                // dependa só da cor — a etiqueta diz, a opacidade confirma.
                opacity: row.is_active ? 1 : 0.6,
              }}
            >
              <header style={{ display: "grid", gap: "var(--sp-2)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                  <StatusTag tone={CATEGORY_TONE[row.category]}>
                    {t(`categories.${row.category}`)}
                  </StatusTag>
                  {row.is_active ? null : <StatusTag tone="draft">{t("inactive")}</StatusTag>}
                </span>
                <strong style={{ fontSize: "var(--fs-subtitle)", color: "var(--text)" }}>
                  {row.name}
                </strong>
              </header>

              <div
                style={{
                  display: "grid",
                  gap: "var(--sp-2)",
                  padding: "var(--sp-3)",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface2)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--sp-2)",
                    fontSize: "var(--fs-body)",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--text)",
                  }}
                >
                  <FileText size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.subject || t("noSubject")}
                  </span>
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.5,
                    color: "var(--muted)",
                  }}
                >
                  {templatePreview(row.body_html) || t("noBody")}
                </p>
              </div>

              {props.canWrite ? (
                <footer
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "var(--sp-2)",
                  }}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    leadingIcon={<Pencil size={14} />}
                    disabled={pending}
                    onClick={() => {
                      setDraft({
                        id: row.id,
                        name: row.name,
                        category: row.category,
                        subject: row.subject,
                        bodyHtml: row.body_html,
                        isActive: row.is_active,
                      });
                      setResult({});
                    }}
                  >
                    {tCommon("edit")}
                  </Button>
                  <Toggle
                    label={t("active")}
                    checked={row.is_active}
                    onCheckedChange={() => alternarAtivo(row)}
                  />
                  <span style={{ marginInlineStart: "auto" }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      disabled={pending}
                      aria-label={t("delete")}
                      title={t("delete")}
                      onClick={() => apagar(row)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </span>
                </footer>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={draft !== null}
        onClose={() => setDraft(null)}
        closeLabel={tCommon("close")}
        title={draft?.id ? t("editTitle") : t("newTitle")}
        subtitle={draft?.id ? draft.name : t("newSubtitle")}
        footer={
          <Button disabled={pending} onClick={guardar}>
            {pending ? t("saving") : tCommon("save")}
          </Button>
        }
      >
        {draft ? (
          <div style={{ display: "grid", gap: "var(--sp-5)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                gap: "var(--sp-4)",
              }}
            >
              <Input
                label={t("nameLabel")}
                value={draft.name}
                maxLength={120}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
              <Select
                label={t("categoryLabel")}
                value={draft.category}
                options={TEMPLATE_CATEGORIES.map((value) => ({
                  value,
                  label: t(`categories.${value}`),
                }))}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value as TemplateCategory })
                }
              />
            </div>

            <Input
              label={t("subjectLabel")}
              hint={t("subjectHint")}
              value={draft.subject}
              maxLength={300}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />

            <RichText
              label={t("bodyLabel")}
              value={draft.bodyHtml}
              resetKey={draft.id ?? "novo"}
              variables={variables}
              minHeight={240}
              onChange={(html: string) => setDraft({ ...draft, bodyHtml: html })}
              labels={richTextLabels(tRoot)}
            />

            {/* A legenda das variáveis, por origem. Responde à pergunta que o
                chip sozinho não responde: quem preenche isto? */}
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                {t("variablesTitle")}
              </strong>
              <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                {t("variablesNote")}
              </p>
              {TEMPLATE_VARIABLE_GROUPS.map((group) => (
                <div key={group} style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <span
                    style={{
                      fontSize: "var(--fs-label)",
                      fontWeight: "var(--fw-semibold)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                    }}
                  >
                    {t(`variableGroups.${group}`)}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
                    {TEMPLATE_VARIABLES.filter((v) => v.group === group).map((v) => (
                      <code
                        key={v.key}
                        style={{
                          padding: "2px var(--sp-2)",
                          borderRadius: "var(--r-xs)",
                          background: "var(--surface2)",
                          fontSize: "var(--fs-label)",
                          color: "var(--text)",
                        }}
                      >
                        {`{{${v.key}}}`}
                      </code>
                    ))}
                  </span>
                </div>
              ))}
            </div>

            <Toggle
              label={t("activeLabel")}
              checked={draft.isActive}
              onCheckedChange={(next) => setDraft({ ...draft, isActive: next })}
            />
            <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
              {t("activeHint")}
            </p>

            {result.error ? (
              <p
                role="alert"
                style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--danger)" }}
              >
                {result.error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
