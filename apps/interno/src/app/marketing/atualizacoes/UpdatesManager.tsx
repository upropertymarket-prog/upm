"use client";

import { useRef, useState, useTransition } from "react";
import { Archive, Eye, ImagePlus, Plus, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AppUpdatesModal,
  Button,
  Input,
  PageHeader,
  Select,
  StatusTag,
  Textarea,
  appUpdatesLabels,
  useToast,
  type StatusTone,
} from "@upm/ui";
import {
  APP_UPDATE_AUDIENCES,
  APP_UPDATE_DELIVERIES,
  APP_UPDATE_STATUS_TONES,
  type AppUpdateRow,
} from "@upm/db/updates";

import { RichText, richTextLabels } from "@upm/ui/editor";

import type { UpdateActionResult } from "./actions";

/**
 * Atualizações — `/marketing/atualizacoes` (P10-07 · 04 §2.6)
 * =========================================================================
 * O primeiro ecrã da área `/marketing`, e o que a faz nascer (07 §24.6).
 *
 * Duas colunas: a lista com estado e **alcance** à esquerda, o editor à
 * direita. O alcance é o número de pessoas que já viram — é a única coisa que
 * distingue uma novidade publicada que chegou de uma que não chegou a ninguém,
 * e sem ele a lista só diria "Publicada" e ficaria por aí.
 *
 * ## A pré-visualização é o modal a sério
 *
 * 04 §2.6 pede "pré-visualização do modal com paginação e Entendi". É o mesmo
 * `AppUpdatesModal` de `@upm/ui` que a app autenticada mostra, com o mesmo
 * `delivery` escolhido no formulário — e o `onAcknowledge` não escreve nada
 * aqui, porque quem está a pré-visualizar não é quem a tem de ler. Uma
 * pré-visualização que fosse um segundo desenho deixava de valer à primeira
 * alteração do modal.
 *
 * ## Uma publicada não se edita, e o ecrã di-lo antes de alguém tentar
 *
 * `app_update_save()` recusa (`20261014120200`): a novidade já foi vista por
 * gente, e as linhas de `app_update_views` dessas pessoas ficariam a apontar
 * para um texto diferente do que elas leram. O formulário fica em leitura e as
 * ações passam a ser arquivar — e escrever outra.
 */

export type UpdatesManagerProps = {
  updates: AppUpdateRow[];
  /** `update_id` → quantas pessoas já a viram. */
  reach: Record<string, number>;
  locale: string;
  onSave: (input: Record<string, unknown>) => Promise<UpdateActionResult>;
  onPublish: (id: string) => Promise<UpdateActionResult>;
  onArchive: (id: string) => Promise<UpdateActionResult>;
  onDelete: (id: string) => Promise<UpdateActionResult>;
  onUploadImage: (formData: FormData) => Promise<UpdateActionResult & { path?: string }>;
};

type Draft = {
  id: string | null;
  version: string;
  title: string;
  bodyHtml: string;
  points: string;
  imagePath: string;
  imageAlt: string;
  audience: (typeof APP_UPDATE_AUDIENCES)[number];
  delivery: (typeof APP_UPDATE_DELIVERIES)[number];
  /** `datetime-local`, que não leva fuso — convertido na gravação. */
  scheduledFor: string;
};

function draftOf(row: AppUpdateRow): Draft {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    bodyHtml: row.body_html,
    points: row.points.join("\n"),
    imagePath: row.image_path ?? "",
    imageAlt: row.image_alt,
    audience: row.audience,
    delivery: row.delivery,
    // O `datetime-local` quer `YYYY-MM-DDTHH:mm` na hora local; o que vem é ISO
    // com fuso. Os 16 primeiros caracteres do ISO local são exatamente isso.
    scheduledFor: row.scheduled_for ? toLocalInput(row.scheduled_for) : "",
  };
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY: Draft = {
  id: null,
  version: "",
  title: "",
  bodyHtml: "",
  points: "",
  imagePath: "",
  imageAlt: "",
  audience: "all",
  delivery: "next_login",
  scheduledFor: "",
};

export function UpdatesManager(props: UpdatesManagerProps) {
  const t = useTranslations("marketing.updates");
  const tRoot = useTranslations();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [draft, setDraft] = useState<Draft | null>(
    props.updates[0] ? draftOf(props.updates[0]) : null,
  );
  const [preview, setPreview] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  /**
   * A imagem sobe assim que é escolhida, e o que fica no rascunho é o caminho.
   * Não espera pelo "Guardar" de propósito: o campo do `alt` só faz sentido
   * depois de haver imagem, e um upload diferido obrigava a gravar duas vezes
   * para a poder descrever.
   */
  function upload(file: File) {
    if (!draft) return;
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      const result = await props.onUploadImage(form);
      if (result.error || !result.path) {
        toast(result.error ?? t("imageFailed"), "error");
        return;
      }
      setDraft({ ...draft, imagePath: result.path });
    });
  }

  const current = draft?.id ? props.updates.find((row) => row.id === draft.id) : null;
  const locked = current?.status === "published" || current?.status === "archived";

  const dateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function run(
    action: () => Promise<UpdateActionResult>,
    after?: (result: UpdateActionResult) => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      if (result.notice) toast(result.notice, "success");
      after?.(result);
    });
  }

  function save() {
    if (!draft) return;
    run(
      () =>
        props.onSave({
          id: draft.id,
          version: draft.version,
          title: draft.title,
          bodyHtml: draft.bodyHtml,
          // Uma linha, um ponto. É o que 04 §8.1.3 desenha como lista no modal,
          // e escrever markdown para três marcas era pedir sintaxe a troco de
          // nada.
          points: draft.points
            .split("\n")
            .map((point) => point.trim())
            .filter(Boolean),
          imagePath: draft.imagePath || null,
          imageAlt: draft.imageAlt,
          audience: draft.audience,
          delivery: draft.delivery,
          scheduledFor: draft.scheduledFor ? new Date(draft.scheduledFor).toISOString() : null,
        }),
      (result) => {
        if (result.id) setDraft({ ...draft, id: result.id });
        if (!result.notice) toast(t("saved"), "success");
      },
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-6)" }}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button leadingIcon={<Plus size={15} />} onClick={() => setDraft({ ...EMPTY })}>
            {t("new")}
          </Button>
        }
      />

      <div
        style={{
          // Duas metades iguais, sem media queries (22 out 2026).
          //
          // Houve aqui três desenhos, e vale a pena saber porque é que este é
          // diferente dos dois anteriores.
          //
          // 1. Grelha `auto-fit` de colunas iguais, com a lista travada em
          //    420 px **por dentro**: as colunas ficavam iguais mas a lista não
          //    as enchia, e sobravam ~270 px de vazio a meio do ecrã.
          // 2. `flex` com `grow` desproporcionado (1 contra 999) e a lista
          //    travada em 340 px: tirou o buraco, mas deixou a página a ~30/70
          //    — que é o que o cliente apontou.
          //
          // Agora os dois pedem a **mesma** base e crescem na **mesma**
          // proporção, e nenhum tem teto. Daí sair 50/50 exacto: o buraco do
          // desenho 1 não volta porque o que o causava era o teto de dentro da
          // lista, e esse desapareceu com ele.
          //
          // O `wrap` mantém-se: quando as duas metades não cabem lado a lado,
          // passam a uma por linha, a 100 % cada. É a responsividade
          // intrínseca que o projeto exige em vez de breakpoints.
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sp-5)",
          alignItems: "start",
        }}
      >
        {/* ------------------------------------------------------------ */}
        {/* A lista, com estado e alcance                                 */}
        {/* ------------------------------------------------------------ */}
        <aside
          aria-label={t("listLabel")}
          style={{
            // Metade. Ver a nota do contentor: mesma base e mesmo `grow` que o
            // editor, e sem teto — era o teto que fazia os 30/70.
            flex: "1 1 min(100%, 320px)",
            // Um item de flex não encolhe abaixo do conteúdo sem isto, e os
            // títulos da lista não quebram linha.
            minWidth: 0,
            display: "grid",
            gap: "var(--sp-2)",
            padding: "var(--sp-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            background: "var(--surface)",
          }}
        >
          {props.updates.length === 0 ? (
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)" }}>{t("empty")}</p>
          ) : (
            props.updates.map((row) => (
              <button
                key={row.id}
                type="button"
                aria-current={draft?.id === row.id ? "true" : undefined}
                onClick={() => setDraft(draftOf(row))}
                style={{
                  display: "grid",
                  gap: "var(--sp-1)",
                  width: "100%",
                  // Um item de grelha não encolhe abaixo do seu conteúdo sem
                  // isto. O título tem `nowrap`, por isso o seu *min-content* é
                  // a linha inteira (~300 px): a coluna da `aside` esticava até
                  // 399 px e o `StatusTag` ia parar por baixo do editor, que
                  // começa 12 px à direita do painel. `minWidth: 0` devolve a
                  // decisão ao `maxWidth` da `aside`, e o título passa a cortar
                  // com reticências — que é o que o `overflow: hidden` abaixo
                  // sempre quis fazer.
                  minWidth: 0,
                  minHeight: "48px",
                  padding: "var(--sp-2) var(--sp-3)",
                  border: 0,
                  borderRadius: "var(--r-md)",
                  background: draft?.id === row.id ? "var(--accent-soft)" : "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--sp-2)",
                    // Pela mesma razão do `minWidth` do botão: esta linha é um
                    // item da grelha dele, e sem isto herdava o mesmo chão de
                    // ~300 px que empurrava o estado para fora do painel.
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "14px",
                      color: "var(--text)",
                    }}
                  >
                    {row.title}
                  </span>
                  <StatusTag tone={APP_UPDATE_STATUS_TONES[row.status] as StatusTone}>
                    {t(`status.${row.status}`)}
                  </StatusTag>
                </span>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {row.version ? `${row.version} · ` : ""}
                  {t(`audience.${row.audience}`)}
                  {/* O alcance só diz algo numa publicada: numa agendada é
                      sempre zero, e um "0 pessoas" ao lado de "Agendada" lia-se
                      como um erro. */}
                  {row.status === "published"
                    ? ` · ${t("reach", { count: props.reach[row.id] ?? 0 })}`
                    : ""}
                  {row.status === "scheduled" && row.scheduled_for
                    ? ` · ${dateFormat.format(new Date(row.scheduled_for))}`
                    : ""}
                </span>
              </button>
            ))
          )}
        </aside>

        {/* ------------------------------------------------------------ */}
        {/* O editor                                                      */}
        {/* ------------------------------------------------------------ */}
        {draft ? (
          <section
            aria-label={t("editorLabel")}
            style={{
              // A outra metade: a mesma base e o mesmo `grow` da lista.
              // `minWidth: 0` porque um item de flex não encolhe abaixo do
              // conteúdo sem isto, e um `<textarea>` lá dentro empurrava a
              // coluna para fora da janela.
              flex: "1 1 min(100%, 320px)",
              minWidth: 0,
              display: "grid",
              gap: "var(--sp-4)",
              padding: "var(--sp-5)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              background: "var(--surface)",
            }}
          >
            {locked ? (
              <p
                role="status"
                style={{
                  margin: 0,
                  padding: "var(--sp-3)",
                  borderRadius: "var(--r-md)",
                  background: "var(--info-soft)",
                  color: "var(--info)",
                  fontSize: "13px",
                }}
              >
                {t("lockedNote")}
              </p>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
                gap: "var(--sp-4)",
              }}
            >
              <Input
                label={t("versionLabel")}
                placeholder={t("versionPlaceholder")}
                value={draft.version}
                maxLength={40}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, version: event.target.value })}
              />
              <Select
                label={t("audienceLabel")}
                value={draft.audience}
                disabled={locked}
                options={APP_UPDATE_AUDIENCES.map((value) => ({
                  value,
                  label: t(`audience.${value}`),
                }))}
                onChange={(event) =>
                  setDraft({ ...draft, audience: event.target.value as Draft["audience"] })
                }
              />
            </div>

            <Input
              label={t("titleLabel")}
              value={draft.title}
              maxLength={160}
              disabled={locked}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />

            {/* A imagem do modal (04 §8.1.3). O `alt` não é opcional: o modal
                abre a toda a gente, e uma imagem sem alternativa textual falha
                o AA de 04 §1.7 na cara de quem usa leitor de ecrã. */}
            <div style={{ display: "grid", gap: "var(--sp-2)" }}>
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: "var(--fw-semibold)",
                  color: "var(--text)",
                }}
              >
                {t("imageLabel")}
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                }}
              >
                <input
                  ref={picker}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) upload(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<ImagePlus size={14} />}
                  disabled={locked || pending}
                  onClick={() => picker.current?.click()}
                >
                  {draft.imagePath ? t("imageReplace") : t("imageChoose")}
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
                  {draft.imagePath || t("imageNone")}
                </span>
                {draft.imagePath && !locked ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft({ ...draft, imagePath: "", imageAlt: "" })}
                  >
                    {t("imageRemove")}
                  </Button>
                ) : null}
              </div>
              {draft.imagePath ? (
                <Input
                  label={t("imageAltLabel")}
                  hint={t("imageAltHint")}
                  value={draft.imageAlt}
                  maxLength={200}
                  disabled={locked}
                  onChange={(event) => setDraft({ ...draft, imageAlt: event.target.value })}
                />
              ) : null}
            </div>

            <Textarea
              label={t("pointsLabel")}
              hint={t("pointsHint")}
              rows={4}
              value={draft.points}
              disabled={locked}
              onChange={(event) => setDraft({ ...draft, points: event.target.value })}
            />

            {locked ? (
              <div
                style={{
                  padding: "var(--sp-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface2)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--muted)",
                }}
                // Já sanitizado na gravação (02 §4.3): o que está na base de
                // dados passou por `sanitizeUpdateBody`.
                // html-ok: `sanitizeUpdateBody` em `packages/db/src/updates.ts`,
                // na escrita, com allowlist de tags.
                dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
              />
            ) : (
              <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--text)",
                  }}
                >
                  {t("bodyLabel")}
                </span>
                <RichText
                  label={t("bodyLabel")}
                  value={draft.bodyHtml}
                  onChange={(html) => setDraft({ ...draft, bodyHtml: html })}
                  labels={richTextLabels(tRoot)}
                  // `resetKey` é o id da atualização: trocar de novidade na
                  // lista repõe o corpo, e escrever na mesma não mexe no cursor.
                  resetKey={draft.id ?? "novo"}
                  minHeight={220}
                />
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                gap: "var(--sp-4)",
              }}
            >
              <Select
                label={t("deliveryLabel")}
                hint={t(`deliveryHint.${draft.delivery}`)}
                value={draft.delivery}
                disabled={locked}
                options={APP_UPDATE_DELIVERIES.map((value) => ({
                  value,
                  label: t(`delivery.${value}`),
                }))}
                onChange={(event) =>
                  setDraft({ ...draft, delivery: event.target.value as Draft["delivery"] })
                }
              />
              <Input
                label={t("scheduleLabel")}
                hint={t("scheduleHint")}
                type="datetime-local"
                value={draft.scheduledFor}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, scheduledFor: event.target.value })}
              />
            </div>

            <footer style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
              {!locked ? (
                <Button disabled={pending} onClick={save}>
                  {pending ? t("saving") : t("save")}
                </Button>
              ) : null}

              <Button
                variant="secondary"
                leadingIcon={<Eye size={15} />}
                // Sem título não há nada para pré-visualizar, e um modal vazio
                // não diz a ninguém como a novidade vai ficar.
                disabled={!draft.title.trim()}
                onClick={() => setPreview(true)}
              >
                {t("preview")}
              </Button>

              {draft.id && !locked ? (
                <Button
                  variant="secondary"
                  leadingIcon={<Send size={15} />}
                  disabled={pending}
                  onClick={() => run(() => props.onPublish(draft.id!))}
                >
                  {t("publish")}
                </Button>
              ) : null}

              {draft.id && current?.status === "published" ? (
                <Button
                  variant="secondary"
                  leadingIcon={<Archive size={15} />}
                  disabled={pending}
                  onClick={() => run(() => props.onArchive(draft.id!))}
                >
                  {t("archive")}
                </Button>
              ) : null}

              {draft.id && !locked ? (
                <Button
                  variant="secondary"
                  leadingIcon={<Trash2 size={15} />}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => props.onDelete(draft.id!),
                      () => setDraft(null),
                    )
                  }
                >
                  {t("delete")}
                </Button>
              ) : null}
            </footer>
          </section>
        ) : (
          <section
            aria-label={t("editorLabel")}
            style={{
              // A mesma metade do editor a sério: sem isto, o convite a
              // escolher uma novidade ficava do tamanho da frase e a lista
              // esticava-se para o resto da linha — os 50/50 só valem se
              // valerem também no ecrã vazio, que é o primeiro que se vê.
              flex: "1 1 min(100%, 320px)",
              minWidth: 0,
              display: "grid",
              placeItems: "center",
              minHeight: "280px",
              padding: "var(--sp-5)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              background: "var(--surface)",
              color: "var(--muted)",
              fontSize: "13px",
            }}
          >
            {t("pickBody")}
          </section>
        )}
      </div>

      {/* A pré-visualização é o modal a sério — ver a nota de topo. */}
      {preview && draft ? (
        <AppUpdatesModal
          updates={[
            {
              id: draft.id ?? "preview",
              version: draft.version,
              title: draft.title,
              bodyHtml: draft.bodyHtml,
              points: draft.points
                .split("\n")
                .map((point) => point.trim())
                .filter(Boolean),
              // A imagem fica de fora da pré-visualização enquanto o upload não
              // existir: o caminho no bucket privado não é um URL, e inventar
              // um dava um retângulo partido em vez de uma pré-visualização.
              imageUrl: null,
              imageAlt: draft.imageAlt,
              // Nunca `mandatory` na pré-visualização: uma obrigatória não tem
              // como ser fechada, e quem está a pré-visualizar ficava preso no
              // seu próprio ecrã.
              delivery: draft.delivery === "mandatory" ? "next_login" : draft.delivery,
            },
          ]}
          labels={appUpdatesLabels(tRoot)}
          openOnMount
          onAcknowledge={() => setPreview(false)}
        />
      ) : null}
    </div>
  );
}
