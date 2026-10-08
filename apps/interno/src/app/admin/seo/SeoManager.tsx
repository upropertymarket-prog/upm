"use client";

import { useState, useTransition } from "react";
import { Card, Checkbox, Drawer, Input, StatusTag, Table, Textarea, Button } from "@upm/ui";
import type { TableColumn } from "@upm/ui";

import type { SeoActionResult, SeoSaveInput } from "./actions";

/**
 * Gestor de SEO e Open Graph por página (P2-06 2.ª metade · 04 §2.1.1)
 * =========================================================================
 * Lista à esquerda, editor num painel lateral à direita — o padrão de 04 §1.4
 * para "ver/editar registo vindo de uma lista", o mesmo das leads e dos
 * utilizadores. Não é um modal: editar SEO não é uma decisão curta, é um
 * formulário com contadores que se afinam a olhar para a pré-visualização.
 *
 * **O estado de cada linha diz de onde vem o que está no ar**, e é a coluna
 * que vale a pena ler primeiro:
 *
 *  - *Usa predefinições* — não há registo em `seo_pages`. O que está no ar é o
 *    `seo.ts`, versionado. É o estado normal e não é um defeito.
 *  - *Completo* — há sobreposição, com título e descrição.
 *  - *Incompleto* — há sobreposição, mas falta o título ou a descrição. Os
 *    campos em falta caem para o ficheiro; o aviso existe porque uma
 *    sobreposição meia é quase sempre um esquecimento, não uma escolha.
 *
 * As pré-visualizações são aproximações honestas, não reproduções: o Google
 * trunca por largura em píxeis e não por número de caracteres, e muda as
 * regras sem avisar. Servem para ver o texto no formato certo e apanhar um
 * título que não cabe — e é por isso que o contador é o que manda.
 */

export type SeoOverrideFields = {
  titleTag: string;
  metaDescription: string;
  ogSameAsPage: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  canonical: string;
  noindex: boolean;
};

export type SeoPageRow = {
  route: string;
  pageName: string;
  dynamic: boolean;
  /** O que o `seo.ts` da rota diz — o valor em vigor quando não há registo. */
  defaults: { titleTag: string; metaDescription: string };
  override: (SeoOverrideFields & { updatedAt: string }) | null;
};

/** Os limites de 04 §2.1.1. Conselho, não regra — ver a nota em `actions.ts`. */
const LIMITS = { titleTag: 60, metaDescription: 160 } as const;

const EMPTY: SeoOverrideFields = {
  titleTag: "",
  metaDescription: "",
  ogSameAsPage: true,
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogImageAlt: "",
  canonical: "",
  noindex: false,
};

type Status = "defaults" | "complete" | "partial";

function statusOf(row: SeoPageRow): Status {
  if (!row.override) return "defaults";
  const { titleTag, metaDescription } = row.override;
  return titleTag.trim() && metaDescription.trim() ? "complete" : "partial";
}

/** O que o visitante vê: a sobreposição quando existe, o ficheiro quando não. */
function effective(row: SeoPageRow, draft: SeoOverrideFields | null) {
  const source = draft ?? row.override;
  return {
    title: source?.titleTag.trim() || row.defaults.titleTag,
    description: source?.metaDescription.trim() || row.defaults.metaDescription,
  };
}

function Counter({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit;
  return (
    <span
      style={{
        fontSize: "var(--fs-label)",
        fontWeight: 700,
        // Vermelho é aviso, não impedimento: o botão de guardar continua
        // ativo, porque o limite é conselho de SEO e a decisão é do marketing.
        color: over ? "var(--danger)" : "var(--muted)",
      }}
    >
      {value.length} / {limit}
    </span>
  );
}

/** Resultado no Google: título, caminho e descrição, no formato dele. */
function GooglePreview({
  route,
  title,
  description,
}: Record<"route" | "title" | "description", string>) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-2)" }}>
      <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
        upropertymarket.pt{route === "/" ? "" : route}
      </span>
      <span
        style={{
          fontSize: "var(--fs-subtitle-lg)",
          color: "var(--info)",
          lineHeight: 1.3,
        }}
      >
        {title}
      </span>
      <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
        {description}
      </span>
    </div>
  );
}

/** Cartão de partilha: a proporção 1200×630 e os dois textos por cima. */
function SocialPreview({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image: string;
}) {
  return (
    <div
      style={{
        borderRadius: "var(--r-md)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <div
        role="img"
        aria-label={image ? `Imagem de partilha: ${image}` : "Sem imagem de partilha definida"}
        style={{
          aspectRatio: "1200 / 630",
          background: "var(--surface2)",
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontSize: "var(--fs-label)",
          padding: "var(--sp-4)",
          textAlign: "center",
        }}
      >
        {image || "Sem imagem — usa a imagem da marca (/og/default.jpg)"}
      </div>
      <div style={{ display: "grid", gap: "var(--sp-1)", padding: "var(--sp-4)" }}>
        <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
          UPROPERTYMARKET.PT
        </span>
        <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>{title}</strong>
        <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>{description}</span>
      </div>
    </div>
  );
}

export function SeoManager({
  rows,
  loadError,
  onSave,
}: {
  rows: SeoPageRow[];
  loadError: boolean;
  onSave: (input: SeoSaveInput) => Promise<SeoActionResult>;
}) {
  const [editing, setEditing] = useState<SeoPageRow | null>(null);
  const [draft, setDraft] = useState<SeoOverrideFields>(EMPTY);
  const [result, setResult] = useState<SeoActionResult>({});
  const [saving, startSaving] = useTransition();

  function open(row: SeoPageRow) {
    setEditing(row);
    setDraft(row.override ?? EMPTY);
    setResult({});
  }

  const set = <K extends keyof SeoOverrideFields>(key: K, value: SeoOverrideFields[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));

  const columns: TableColumn<SeoPageRow>[] = [
    {
      id: "page",
      header: "Página",
      cell: (row) => (
        <span style={{ display: "grid", gap: "2px" }}>
          <strong style={{ color: "var(--text)" }}>{row.pageName}</strong>
          <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
            {row.route}
            {row.dynamic ? " · template" : ""}
          </span>
        </span>
      ),
    },
    {
      id: "title",
      header: "Título em vigor",
      cell: (row) => effective(row, null).title,
    },
    {
      id: "status",
      header: "Estado",
      width: "170px",
      cell: (row) => {
        // Tons do ciclo de vida genérico de `STATUS_TONES`, não cores novas:
        // 04 §1.6 é explícito em "cores nunca repetidas para significados
        // diferentes", e uma quarta família de verdes seria exatamente isso.
        const status = statusOf(row);
        if (status === "complete") return <StatusTag tone="active">Completo</StatusTag>;
        if (status === "partial") return <StatusTag tone="pending">Incompleto</StatusTag>;
        return <StatusTag tone="draft">Usa predefinições</StatusTag>;
      },
    },
  ];

  const preview = editing ? effective(editing, draft) : null;
  const ogTitle = draft.ogSameAsPage
    ? (preview?.title ?? "")
    : draft.ogTitle || (preview?.title ?? "");
  const ogDescription = draft.ogSameAsPage
    ? (preview?.description ?? "")
    : draft.ogDescription || (preview?.description ?? "");

  return (
    <>
      <PageHeading />

      {loadError ? (
        <Card padded style={{ marginBottom: "var(--sp-6)" }}>
          <p role="alert" style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--danger)" }}>
            Não foi possível ler as personalizações. A lista mostra os valores dos ficheiros.
          </p>
        </Card>
      ) : null}

      <Table
        caption="Páginas públicas e o respetivo SEO"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.route}
        onRowClick={open}
        selectedKey={editing?.route}
        empty="Nenhuma rota pública encontrada. Corra `pnpm seo:routes`."
      />

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        closeLabel="Fechar"
        title={editing?.pageName ?? ""}
        subtitle={editing?.route}
        footer={
          <Button
            disabled={saving}
            onClick={() => {
              if (!editing) return;
              startSaving(async () => {
                const outcome = await onSave({ route: editing.route, ...draft });
                setResult(outcome);
                if (outcome.ok) setEditing(null);
              });
            }}
          >
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        }
      >
        {editing ? (
          <div style={{ display: "grid", gap: "var(--sp-6)" }}>
            <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
              Campos deixados em branco usam o valor do ficheiro{" "}
              <code>app{editing.route === "/" ? "" : editing.route}/seo.ts</code>. Limpar tudo
              devolve a página inteira ao ficheiro.
            </p>

            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <Input
                label="Title Tag"
                value={draft.titleTag}
                placeholder={editing.defaults.titleTag}
                onChange={(event) => set("titleTag", event.target.value)}
              />
              <Counter value={draft.titleTag} limit={LIMITS.titleTag} />
            </div>

            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <Textarea
                label="Meta Description"
                rows={3}
                value={draft.metaDescription}
                placeholder={editing.defaults.metaDescription}
                onChange={(event) => set("metaDescription", event.target.value)}
              />
              <Counter value={draft.metaDescription} limit={LIMITS.metaDescription} />
            </div>

            <Checkbox
              label="Open Graph igual aos dados da página"
              checked={draft.ogSameAsPage}
              onChange={(event) => set("ogSameAsPage", event.target.checked)}
            />

            {/* Os campos OG só aparecem quando podem ser usados: mostrá-los
                desativados ao lado da caixa ligada é oferecer um controlo que
                não faz nada. */}
            {draft.ogSameAsPage ? null : (
              <>
                <Input
                  label="Open Graph Title"
                  value={draft.ogTitle}
                  onChange={(event) => set("ogTitle", event.target.value)}
                />
                <Textarea
                  label="Open Graph Description"
                  rows={3}
                  value={draft.ogDescription}
                  onChange={(event) => set("ogDescription", event.target.value)}
                />
              </>
            )}

            <Input
              label="Open Graph Image"
              hint="Caminho em /public (1200×630) ou URL absoluto. Sem valor, usa a imagem da marca."
              value={draft.ogImage}
              placeholder="/og/home.jpg"
              onChange={(event) => set("ogImage", event.target.value)}
            />
            <Input
              label="Texto alternativo da imagem"
              value={draft.ogImageAlt}
              onChange={(event) => set("ogImageAlt", event.target.value)}
            />
            <Input
              label="Canonical"
              hint="Opcional. URL absoluto; sem valor, usa o URL da própria página."
              value={draft.canonical}
              placeholder="https://upropertymarket.pt/"
              onChange={(event) => set("canonical", event.target.value)}
            />
            <Checkbox
              label="noindex — pedir aos motores de busca que não indexem esta página"
              checked={draft.noindex}
              onChange={(event) => set("noindex", event.target.checked)}
            />

            <div style={{ display: "grid", gap: "var(--sp-4)" }}>
              <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                Resultado no Google
              </strong>
              <Card padded>
                <GooglePreview
                  route={editing.route}
                  title={preview?.title ?? ""}
                  description={preview?.description ?? ""}
                />
              </Card>
            </div>

            <div style={{ display: "grid", gap: "var(--sp-4)" }}>
              <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                Partilha no Facebook, LinkedIn, WhatsApp e X
              </strong>
              <SocialPreview title={ogTitle} description={ogDescription} image={draft.ogImage} />
            </div>

            {result.error ? (
              <p
                role="alert"
                style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--danger)" }}
              >
                {result.error}
              </p>
            ) : null}
            {result.notice ? (
              <p
                role="status"
                style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--warn)" }}
              >
                {result.notice}
              </p>
            ) : null}

            {editing.override ? (
              <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                Personalizado. Última alteração em{" "}
                {new Date(editing.override.updatedAt).toLocaleString("pt-PT")}.
              </span>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

/** Separado só para o componente principal não começar por vinte linhas de JSX. */
function PageHeading() {
  return (
    <header style={{ display: "grid", gap: "var(--sp-2)", marginBottom: "var(--sp-7)" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--fs-title)" }}>
        SEO
      </h1>
      <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
        Título, descrição e cartão de partilha de cada página pública. O que aqui guardar fica ativo
        no site dentro de um minuto, sem novo deploy.
      </p>
    </header>
  );
}
