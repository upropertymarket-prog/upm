"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@upm/config";
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
 * **A coluna "Última alteração" é o rasto, não a data do ficheiro.** Diz quando
 * e por quem esta página foi editada *aqui*; uma página que nunca passou pelo
 * painel aparece como "nunca editada aqui" em vez de pedir emprestada a data do
 * último commit, que mede outra coisa. Uma página devolvida ao ficheiro perde a
 * linha em `seo_pages` mas não perde o rasto — essa vem do `audit_log`, e é
 * marcada como tal.
 *
 * As pré-visualizações são aproximações honestas, não reproduções: o Google
 * trunca por largura em píxeis e não por número de caracteres, e muda as
 * regras sem avisar. Servem para ver o texto no formato certo e apanhar um
 * título que não cabe — e é por isso que o contador é o que manda.
 *
 * ---------------------------------------------------------------------------
 * DOIS IDIOMAS, UMA LINHA (21 OUT 2026 · D72 fase C)
 * ---------------------------------------------------------------------------
 * `seo_pages` passou a ter a chave `(route, locale)`. Até aqui uma edição
 * aplicava-se às duas línguas ao mesmo tempo, o que significa que **quem
 * corrigisse um título em produção escrevia-o nos dois idiomas** — português
 * na versão inglesa, sem nada que o dissesse.
 *
 * A lista continua com uma linha por rota e as línguas vivem em **abas dentro
 * do painel**. As duas razões, por ordem:
 *
 *  - um título e a sua tradução comparam-se a olhar um para o outro, e em duas
 *    linhas da tabela isso obrigava a abrir e fechar o painel;
 *  - a coluna de estado passa a poder dizer o estado de cada idioma, que é a
 *    informação que a decisão de abrir uma linha precisa. Em vinte e seis
 *    linhas, metade delas diria "usa predefinições" para sempre.
 *
 * **O botão guarda os idiomas que foram mexidos**, não só o da aba aberta.
 * Trocar de aba, escrever nas duas e guardar é o gesto natural aqui; gravar só
 * a visível perdia silenciosamente o trabalho da outra — e perder texto que
 * alguém escreveu é bem pior do que uma gravação a mais.
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

/**
 * Quando e por quem, para uma rota. É `null` quando ninguém mexeu nesta página
 * a partir do Admin — e aí a resposta honesta é que a última alteração está no
 * git, não aqui.
 */
export type SeoLastChange = {
  /** ISO. Formatado no cliente com o fuso fixo — ver `formatWhen`. */
  at: string;
  /** Nome de quem alterou. `null` quando o perfil já não existe. */
  by: string | null;
  /** A última alteração foi limpar os campos, devolvendo a página ao ficheiro. */
  reset?: boolean;
};

/** O que uma rota tem num idioma: o ficheiro, a sobreposição e o rasto. */
export type SeoLocaleState = {
  /** O que o `seo.ts` da rota diz **neste idioma** — o valor em vigor sem registo. */
  defaults: { titleTag: string; metaDescription: string };
  override: SeoOverrideFields | null;
  lastChange: SeoLastChange | null;
};

export type SeoPageRow = {
  route: string;
  /** No idioma de quem está a ver o painel — ver a nota no `page.tsx`. */
  pageName: string;
  dynamic: boolean;
  /**
   * O URL público em cada idioma (`/termos`, `/en/terms`), para a
   * pré-visualização mostrar o endereço que o visitante vê. Vem do inventário
   * gerado, porque o mapa de caminhos vive no `apps/web` e isto é outra app.
   */
  path: Record<Locale, string>;
  locales: Record<Locale, SeoLocaleState>;
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

function statusOf(state: SeoLocaleState): Status {
  if (!state.override) return "defaults";
  const { titleTag, metaDescription } = state.override;
  return titleTag.trim() && metaDescription.trim() ? "complete" : "partial";
}

/** O que o visitante vê: a sobreposição quando existe, o ficheiro quando não. */
function effective(state: SeoLocaleState, draft: SeoOverrideFields | null) {
  const source = draft ?? state.override;
  return {
    title: source?.titleTag.trim() || state.defaults.titleTag,
    description: source?.metaDescription.trim() || state.defaults.metaDescription,
  };
}

/** Dois rascunhos abertos ao mesmo tempo, um por aba. */
type Drafts = Record<Locale, SeoOverrideFields>;

const draftsFrom = (row: SeoPageRow): Drafts =>
  Object.fromEntries(LOCALES.map((loc) => [loc, row.locales[loc].override ?? EMPTY])) as Drafts;

/**
 * Se um rascunho difere do que estava. É isto que decide o que o botão grava.
 *
 * Comparação por JSON e não campo a campo: os campos são nove e planos, e uma
 * comparação escrita à mão passava a ter de ser atualizada ao lado de cada
 * campo novo — e quem se esquecesse dela via o campo novo deixar de ser
 * gravado, em silêncio.
 */
const changed = (a: SeoOverrideFields, b: SeoOverrideFields) =>
  JSON.stringify(a) !== JSON.stringify(b);

/**
 * Data e hora de uma alteração.
 *
 * **O fuso é fixo e não é um detalhe.** Esta lista é desenhada no servidor e
 * hidratada no browser; sem `timeZone`, o servidor formata em UTC e o browser
 * no fuso de quem lê, e o React acusa a diferença. `Europe/Lisbon` é a mesma
 * escolha — e pela mesma razão — do `timeZone` do `next-intl` em
 * `packages/config/server.ts`: as horas do produto são as de Portugal.
 */
function formatWhen(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(value));
}

/** A coluna "Última alteração": quando, em cima; quem, por baixo. */
function LastChangeCell({ change, locale }: { change: SeoLastChange | null; locale: string }) {
  const t = useTranslations("admin.seo");

  if (!change) {
    return (
      <span style={{ display: "grid", gap: "2px" }}>
        <span style={{ color: "var(--muted)" }}>—</span>
        <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
          {t("neverEditedShort")}
        </span>
      </span>
    );
  }

  return (
    <span style={{ display: "grid", gap: "2px" }}>
      <span style={{ color: "var(--text)" }}>{formatWhen(change.at, locale)}</span>
      <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
        {change.by ?? t("authorRemoved")}
        {change.reset ? t("resetToFile") : ""}
      </span>
    </span>
  );
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
  const t = useTranslations("admin.seo");

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
        aria-label={image ? t("shareImageAlt", { path: image }) : t("shareImageNone")}
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
        {image || t("shareImageFallback")}
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
  locale,
  onSave,
}: {
  rows: SeoPageRow[];
  loadError: boolean;
  /**
   * Para as datas. Os textos vêm do ficheiro de mensagens como em todo o
   * produto — este ecrã dizia "são de administração, em pt" e isso nunca foi
   * verdade: o painel tem seletor de idioma ao lado (gate:i18n, 15 out 2026).
   */
  locale: string;
  onSave: (input: SeoSaveInput) => Promise<SeoActionResult>;
}) {
  const t = useTranslations("admin.seo");
  const tLocale = useTranslations("locale");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState<SeoPageRow | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  /** A aba aberta. Começa no idioma do painel, que é o que quem abre está a ler. */
  const [tab, setTab] = useState<Locale>(DEFAULT_LOCALE);
  const [result, setResult] = useState<SeoActionResult>({});
  const [saving, startSaving] = useTransition();

  const viewerLocale: Locale = LOCALES.includes(locale as Locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;

  function open(row: SeoPageRow) {
    setEditing(row);
    setDrafts(draftsFrom(row));
    setTab(viewerLocale);
    setResult({});
  }

  const draft = drafts?.[tab] ?? EMPTY;

  const set = <K extends keyof SeoOverrideFields>(key: K, value: SeoOverrideFields[K]) =>
    setDrafts((previous) =>
      previous ? { ...previous, [tab]: { ...previous[tab], [key]: value } } : previous,
    );

  const columns: TableColumn<SeoPageRow>[] = [
    {
      id: "page",
      header: t("columns.page"),
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
      // O título **no idioma do painel**. Mostrar os dois aqui duplicava a
      // altura de cada linha por uma informação que o painel dá melhor; qual
      // dos dois está em vigor lê-se na coluna de estado, ao lado.
      header: t("columns.title"),
      cell: (row) => effective(row.locales[viewerLocale], null).title,
    },
    {
      id: "lastChange",
      header: t("columns.lastChange"),
      width: "190px",
      // A mais recente das duas: a pergunta que esta coluna responde é "esta
      // página andou a ser mexida?", e essa não se divide por idioma.
      cell: (row) => {
        const changes = LOCALES.map((loc) => row.locales[loc].lastChange).filter(
          (change): change is SeoLastChange => change !== null,
        );
        const latest = changes.sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
        return <LastChangeCell change={latest} locale={locale} />;
      },
    },
    {
      id: "status",
      header: t("columns.status"),
      width: "210px",
      // Um estado por idioma, desde a fase C. "Personalizada" deixou de ser
      // uma resposta completa: uma página pode estar corrigida em português e
      // a usar o ficheiro em inglês, e é essa diferença que vale a pena ver
      // antes de abrir a linha.
      //
      // Tons do ciclo de vida genérico de `STATUS_TONES`, não cores novas:
      // 04 §1.6 é explícito em "cores nunca repetidas para significados
      // diferentes", e uma quarta família de verdes seria exatamente isso.
      cell: (row) => (
        <span style={{ display: "grid", gap: "var(--sp-1)" }}>
          {LOCALES.map((loc) => {
            const status = statusOf(row.locales[loc]);
            return (
              <span key={loc} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                {/* O código do idioma, não um rótulo: `PT`/`EN` é o mesmo nas
                    duas línguas do painel e deriva do próprio valor. */}
                <span
                  style={{
                    fontSize: "var(--fs-label)",
                    fontWeight: 700,
                    color: "var(--muted)",
                    minWidth: "22px",
                  }}
                >
                  {loc.toUpperCase()}
                </span>
                {status === "complete" ? (
                  <StatusTag tone="active">{t("status.complete")}</StatusTag>
                ) : status === "partial" ? (
                  <StatusTag tone="pending">{t("status.partial")}</StatusTag>
                ) : (
                  <StatusTag tone="draft">{t("status.defaults")}</StatusTag>
                )}
              </span>
            );
          })}
        </span>
      ),
    },
  ];

  const editingState = editing ? editing.locales[tab] : null;
  const preview = editingState ? effective(editingState, draft) : null;
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
            {t("loadError")}
          </p>
        </Card>
      ) : null}

      <Table
        caption={t("tableCaption")}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.route}
        onRowClick={open}
        selectedKey={editing?.route}
        empty={t("tableEmpty")}
      />

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        closeLabel={tCommon("close")}
        title={editing?.pageName ?? ""}
        subtitle={editing?.route}
        footer={
          <Button
            disabled={saving}
            onClick={() => {
              if (!editing || !drafts) return;
              startSaving(async () => {
                /**
                 * Os idiomas mexidos, e o da aba aberta quando nenhum o foi —
                 * esse caso é uma gravação idempotente, e é o que o botão fazia
                 * antes das abas existirem.
                 *
                 * Sequencial e não em paralelo: se a segunda falhar, a primeira
                 * já está guardada, e o que o utilizador precisa de ver é **qual**
                 * falhou. Em paralelo as duas mensagens de erro corriam uma por
                 * cima da outra.
                 */
                const mexidos = LOCALES.filter((loc) =>
                  changed(drafts[loc], editing.locales[loc].override ?? EMPTY),
                );
                const aGravar = mexidos.length > 0 ? mexidos : [tab];

                for (const loc of aGravar) {
                  const outcome = await onSave({
                    route: editing.route,
                    locale: loc,
                    ...drafts[loc],
                  });
                  if (!outcome.ok) {
                    // A aba salta para o idioma que falhou: a mensagem fala dos
                    // campos que estão à frente de quem a lê.
                    setTab(loc);
                    setResult(outcome);
                    return;
                  }
                  setResult(outcome);
                }
                setEditing(null);
              });
            }}
          >
            {saving ? t("saving") : tCommon("save")}
          </Button>
        }
      >
        {editing && editingState && drafts ? (
          <div style={{ display: "grid", gap: "var(--sp-6)" }}>
            {/* As abas de idioma. `role="tablist"` e não botões soltos: o que
                isto é, para quem navega por teclado ou leitor de ecrã, são
                duas vistas do mesmo formulário — e é isso que a semântica
                tem de dizer. A seta por baixo marca a ativa sem depender só
                da cor (04 §1.6). */}
            <div
              role="tablist"
              aria-label={t("localeTabs")}
              style={{
                display: "flex",
                gap: "var(--sp-1)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {LOCALES.map((loc) => {
                const ativa = loc === tab;
                const mexida = changed(drafts[loc], editing.locales[loc].override ?? EMPTY);
                return (
                  <button
                    key={loc}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setTab(loc)}
                    style={{
                      appearance: "none",
                      background: "transparent",
                      border: "none",
                      borderBottom: `2px solid ${ativa ? "var(--accent)" : "transparent"}`,
                      color: ativa ? "var(--text)" : "var(--muted)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: "var(--fs-body)",
                      fontWeight: ativa ? 700 : 400,
                      padding: "var(--sp-3) var(--sp-4)",
                      marginBottom: "-1px",
                    }}
                  >
                    {tLocale(loc)}
                    {/* Um ponto para dizer "há aqui coisa por guardar". Sem
                        ele, trocar de aba e guardar parecia não ter feito nada
                        à aba que ficou atrás. */}
                    {mexida ? (
                      <span aria-hidden="true" style={{ color: "var(--accent)" }}>
                        {" •"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
              {t.rich("fieldsHint", {
                file: `app${editing.route === "/" ? "" : editing.route}/seo.ts`,
                code: (chunks) => <code>{chunks}</code>,
              })}
            </p>

            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <Input
                label={t("titleTag")}
                value={draft.titleTag}
                placeholder={editingState.defaults.titleTag}
                onChange={(event) => set("titleTag", event.target.value)}
              />
              <Counter value={draft.titleTag} limit={LIMITS.titleTag} />
            </div>

            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <Textarea
                label={t("metaDescription")}
                rows={3}
                value={draft.metaDescription}
                placeholder={editingState.defaults.metaDescription}
                onChange={(event) => set("metaDescription", event.target.value)}
              />
              <Counter value={draft.metaDescription} limit={LIMITS.metaDescription} />
            </div>

            <Checkbox
              label={t("ogSameAsPage")}
              checked={draft.ogSameAsPage}
              onChange={(event) => set("ogSameAsPage", event.target.checked)}
            />

            {/* Os campos OG só aparecem quando podem ser usados: mostrá-los
                desativados ao lado da caixa ligada é oferecer um controlo que
                não faz nada. */}
            {draft.ogSameAsPage ? null : (
              <>
                <Input
                  label={t("ogTitle")}
                  value={draft.ogTitle}
                  onChange={(event) => set("ogTitle", event.target.value)}
                />
                <Textarea
                  label={t("ogDescription")}
                  rows={3}
                  value={draft.ogDescription}
                  onChange={(event) => set("ogDescription", event.target.value)}
                />
              </>
            )}

            <Input
              label={t("ogImage")}
              hint={t("ogImageHint")}
              value={draft.ogImage}
              placeholder="/og/home.jpg"
              onChange={(event) => set("ogImage", event.target.value)}
            />
            <Input
              label={t("ogImageAlt")}
              value={draft.ogImageAlt}
              onChange={(event) => set("ogImageAlt", event.target.value)}
            />
            <Input
              label={t("canonical")}
              hint={t("canonicalHint")}
              value={draft.canonical}
              placeholder="https://upropertymarket.pt/"
              onChange={(event) => set("canonical", event.target.value)}
            />
            <Checkbox
              label={t("noindex")}
              checked={draft.noindex}
              onChange={(event) => set("noindex", event.target.checked)}
            />

            <div style={{ display: "grid", gap: "var(--sp-4)" }}>
              <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                {t("googlePreview")}
              </strong>
              <Card padded>
                {/* O caminho do idioma da aba, não a chave da rota: é o URL
                    que o visitante vê, e é o que o Google mostra. */}
                <GooglePreview
                  route={editing.path[tab]}
                  title={preview?.title ?? ""}
                  description={preview?.description ?? ""}
                />
              </Card>
            </div>

            <div style={{ display: "grid", gap: "var(--sp-4)" }}>
              <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                {t("socialPreview")}
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

            {/* O rodapé fala do idioma aberto, não da rota: uma página pode
                estar personalizada numa língua e a usar o ficheiro na outra, e
                dizer "personalizado" sem dizer de qual era meia-verdade. */}
            <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
              {editingState.override ? t("overrideOn") : t("overrideOff")}
              {editingState.lastChange
                ? t("lastChangeBy", {
                    when: formatWhen(editingState.lastChange.at, locale),
                    who: editingState.lastChange.by ?? t("authorRemovedInline"),
                  })
                : t("neverEdited")}
            </span>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

/** Separado só para o componente principal não começar por vinte linhas de JSX. */
function PageHeading() {
  const t = useTranslations("admin.seo");

  return (
    <header style={{ display: "grid", gap: "var(--sp-2)", marginBottom: "var(--sp-7)" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--fs-title)" }}>
        {t("title")}
      </h1>
      <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
        {t("subtitle")}
      </p>
    </header>
  );
}
