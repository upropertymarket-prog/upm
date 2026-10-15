"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  ChevronRight,
  Download,
  Heading,
  Image as ImageIcon,
  Minus,
  Monitor,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  PanelTop,
  PenLine,
  Pencil,
  Plus,
  Send,
  Smartphone,
  Trash2,
  Type,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Input,
  PageHeader,
  Select,
  StatusTag,
  Toggle,
  useToast,
  type StatusTone,
} from "@upm/ui";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_DEFAULT_BG,
  CAMPAIGN_STATUS_TONES,
  type CampaignAudience,
  type CampaignEmailRow,
  type CampaignRow,
  type CampaignSender,
  type CampaignStatus,
} from "@upm/db/campaigns";
import {
  CAMPAIGN_BLOCK_TYPES,
  CAMPAIGN_VARIABLES,
  createCampaignBlock,
  defaultCampaignBlocks,
  type CampaignBlock,
  type CampaignBlockType,
} from "@upm/db/campaign-blocks";

import { BlockCanvas } from "./BlockCanvas";
import type { CampaignActionResult, PreviewInput } from "./actions";

/**
 * O construtor visual de campanhas — `/marketing/campanhas` (P10-08 · 04 §2.6)
 * =========================================================================
 * A peça maior de P10-08, e o ecrã que 04 §2.6 especifica ao pormenor. A
 * estrutura é a dessa secção, e não uma interpretação dela:
 *
 * - **Cabeçalho em três faixas** — a campanha (seletor, público, remetente,
 *   estado), a sequência (separadores de e-mails + adicionar) e o e-mail
 *   selecionado (assunto, pré-cabeçalho). Três faixas e não um formulário
 *   único porque são três níveis diferentes: o que é da campanha, o que é da
 *   sequência e o que é deste e-mail. Misturá-los era o que fazia ninguém
 *   perceber que mudar o assunto não muda o assunto dos outros.
 * - **Coluna esquerda fixa** com os Blocos e o Estilo por baixo; o canvas
 *   ocupa o resto.
 * - **Pré-visualização computador/telemóvel** com o renderizador a sério.
 *
 * ## O que cada ação faz, e quem a executa
 *
 * "Enviar" põe a campanha em `sending` e materializa os destinatários dentro do
 * Postgres; **a entrega é do `mail-worker`**, que leva o lote na passagem
 * seguinte. Por isso a mensagem de volta diz quantos ficaram na fila e não
 * "enviada": a app não fala com SMTP (02 §3.3), e prometer o que não controla
 * era mentir no sítio mais visível.
 *
 * "Enviar teste" manda **o que está guardado** — o id do e-mail, não os blocos
 * que o ecrã tem na mão — para um endereço escrito na hora. Um teste sobre um
 * rascunho não gravado provava uma coisa e o envio fazia outra.
 *
 * "Agendar" põe o estado e a data. Quem dispara é P10-09, e isso está dito no
 * aviso que acompanha o botão.
 *
 * ## A contagem da audiência pode ser zero, e isso não é um defeito
 *
 * Decisão do cliente a 15 out 2026: as campanhas a registados são **opt-in
 * explícito**, porque é o que os Termos prometem. `profiles.marketing_consent`
 * nasceu `false` e o registo ainda não o recolhe (D69) — por isso `all`,
 * `owners` e `buyers` dão zero. O ecrã diz-lo com uma frase, no sítio onde o
 * número aparece, em vez de deixar o Marketing a pensar que a leitura falhou.
 */

export type CampaignBuilderProps = {
  campaigns: CampaignRow[];
  selected: CampaignRow | null;
  emails: CampaignEmailRow[];
  /** Os blocos já validados contra o contrato, por `id` de e-mail. */
  blocksByEmail: Record<string, CampaignBlock[]>;
  delayByEmail: Record<string, number>;
  selectedEmailId: string | null;
  senders: CampaignSender[];
  properties: { id: string; label: string }[];
  /** A contagem da audiência da campanha aberta, lida no servidor. */
  audienceCount: number | null;
  locale: string;
  onSaveCampaign: (input: Record<string, unknown>) => Promise<CampaignActionResult>;
  onDeleteCampaign: (id: string) => Promise<CampaignActionResult>;
  onSaveEmail: (input: Record<string, unknown>) => Promise<CampaignActionResult>;
  onDeleteEmail: (id: string) => Promise<CampaignActionResult>;
  onSchedule: (input: Record<string, unknown>) => Promise<CampaignActionResult>;
  onUnschedule: (id: string) => Promise<CampaignActionResult>;
  onSend: (id: string) => Promise<CampaignActionResult>;
  onSendTest: (input: Record<string, unknown>) => Promise<CampaignActionResult>;
  onCountAudience: (audience: string) => Promise<{ count?: number; error?: string }>;
  onPreview: (input: PreviewInput) => Promise<{ html?: string; error?: string }>;
  onUploadImage: (
    formData: FormData,
  ) => Promise<CampaignActionResult & { path?: string; url?: string }>;
};

const BLOCK_ICONS: Record<CampaignBlockType, React.ReactNode> = {
  header: <PanelTop size={14} />,
  heading: <Heading size={14} />,
  text: <Type size={14} />,
  image: <ImageIcon size={14} />,
  button: <MousePointerClick size={14} />,
  property: <Building2 size={14} />,
  divider: <Minus size={14} />,
  spacer: <MoveVertical size={14} />,
  signature: <PenLine size={14} />,
  footer: <PanelBottom size={14} />,
};

/** As larguras de 04 §2.6: o corpo de um e-mail e um telefone. */
const PREVIEW_WIDTH = { desktop: 600, mobile: 360 } as const;

type View = "edit" | "desktop" | "mobile";

export function CampaignBuilder(props: CampaignBuilderProps) {
  const t = useTranslations("marketing.campaigns");
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const campaign = props.selected;
  const locked = campaign?.status === "sending" || campaign?.status === "sent";

  // -------------------------------------------------------------------------
  // Os dois rascunhos: o da campanha e o do e-mail aberto
  // -------------------------------------------------------------------------

  const [name, setName] = useState(campaign?.name ?? "");
  const [audience, setAudience] = useState<CampaignAudience>(
    (campaign?.audience as CampaignAudience) ?? "all",
  );
  const [fromMailboxId, setFromMailboxId] = useState(campaign?.from_mailbox_id ?? "");
  const [emailBg, setEmailBg] = useState(campaign?.email_bg ?? CAMPAIGN_DEFAULT_BG);
  const [count, setCount] = useState<number | null>(props.audienceCount);

  const email = props.emails.find((row) => row.id === props.selectedEmailId) ?? null;

  const [subject, setSubject] = useState(email?.subject ?? "");
  const [preheader, setPreheader] = useState(email?.preheader ?? "");
  const [delayDays, setDelayDays] = useState(email ? (props.delayByEmail[email.id] ?? 0) : 0);
  const [blocks, setBlocks] = useState<CampaignBlock[]>(
    email ? (props.blocksByEmail[email.id] ?? []) : [],
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  /**
   * Trocar de campanha ou de e-mail é uma navegação (o estado está no URL), e o
   * servidor volta com as linhas novas. Estes dois `useEffect` são o que repõe
   * os rascunhos a partir delas — a chave é o `id`, e não o conteúdo, para que
   * escrever não reponha o que se está a escrever.
   */
  useEffect(() => {
    setName(campaign?.name ?? "");
    setAudience((campaign?.audience as CampaignAudience) ?? "all");
    setFromMailboxId(campaign?.from_mailbox_id ?? "");
    setEmailBg(campaign?.email_bg ?? CAMPAIGN_DEFAULT_BG);
    setCount(props.audienceCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  useEffect(() => {
    setSubject(email?.subject ?? "");
    setPreheader(email?.preheader ?? "");
    setDelayDays(email ? (props.delayByEmail[email.id] ?? 0) : 0);
    setBlocks(email ? (props.blocksByEmail[email.id] ?? []) : []);
    setSelectedBlockId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email?.id]);

  // -------------------------------------------------------------------------
  // A pré-visualização
  // -------------------------------------------------------------------------

  const [view, setView] = useState<View>("edit");
  const [withData, setWithData] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [scheduledFor, setScheduledFor] = useState(
    campaign?.scheduled_at ? toLocalInput(campaign.scheduled_at) : "",
  );

  /**
   * O HTML vem do servidor, que é onde o `renderCampaignHtml` corre (React
   * Email não vai para o browser). Pedido ao **entrar** na pré-visualização e
   * ao mudar o "Com dados" — e não a cada tecla: uma ida ao servidor por
   * carácter escrito num assunto não acrescenta nada a quem está a escrever.
   */
  useEffect(() => {
    if (view === "edit" || blocks.length === 0) return;
    let cancelled = false;

    void props
      .onPreview({ blocks, subject, preheader, background: emailBg, withData })
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          toast(result.error, "error");
          return;
        }
        setPreviewHtml(result.html ?? "");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, withData, blocks, emailBg]);

  // -------------------------------------------------------------------------
  // As ações
  // -------------------------------------------------------------------------

  /**
   * A navegação é só a *query*, como na caixa de e-mail e nos tickets: o
   * caminho não se repete em cinco sítios e as rotas tipadas do Next aceitam-na
   * sem `as Route`. `scroll: false` porque trocar de e-mail da sequência não é
   * mudar de página — e perder a posição no canvas a cada separador era pior do
   * que não ter separadores.
   */
  function navegar(next: { campanha?: string; email?: string }) {
    const params = new URLSearchParams();
    if (next.campanha) params.set("campanha", next.campanha);
    if (next.email) params.set("email", next.email);
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  function run(
    action: () => Promise<CampaignActionResult>,
    after?: (result: CampaignActionResult) => void,
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

  function novaCampanha() {
    run(
      () =>
        props.onSaveCampaign({
          id: null,
          name: t("newName"),
          audience: "all",
          fromMailboxId: null,
          emailBg: CAMPAIGN_DEFAULT_BG,
        }),
      (result) => {
        if (result.id) navegar({ campanha: result.id });
      },
    );
  }

  function guardar() {
    if (!campaign) return;
    run(() =>
      props.onSaveCampaign({
        id: campaign.id,
        name,
        audience,
        fromMailboxId: fromMailboxId || null,
        emailBg,
      }),
    );
    if (email) {
      run(() =>
        props.onSaveEmail({
          id: email.id,
          campaignId: campaign.id,
          name: email.name,
          subject,
          preheader,
          blocks,
          delayDays,
        }),
      );
    }
  }

  function adicionarEmail() {
    if (!campaign) return;
    run(
      () =>
        props.onSaveEmail({
          id: null,
          campaignId: campaign.id,
          name: "",
          subject: "",
          preheader: "",
          // Um e-mail novo da sequência nasce com os blocos por omissão — com
          // o rodapé, porque um e-mail que nasce já inválido obrigava a
          // descobrir a regra ao tentar gravar.
          blocks: defaultCampaignBlocks(),
          // Três dias: o exemplo do doc 05 (`+3 days`). Um e-mail de sequência
          // com espera zero sai ao mesmo tempo que o anterior, que não é o que
          // ninguém quer de uma sequência.
          delayDays: 3,
        }),
      (result) => {
        if (result.id) {
          navegar({ campanha: campaign.id, email: result.id });
        }
      },
    );
  }

  function inserirBloco(type: CampaignBlockType) {
    const novo = createCampaignBlock(type);
    const next = [...blocks];

    // Onde entra: depois do bloco selecionado, ou — sem seleção — **antes do
    // rodapé**, que é onde quem está a escrever quer sempre o bloco seguinte.
    const at = selectedBlockId
      ? next.findIndex((block) => block.id === selectedBlockId) + 1
      : Math.max(
          0,
          next.findIndex((block) => block.type === "footer"),
        );

    next.splice(at < 0 ? next.length : at, 0, novo);
    setBlocks(next);
    setSelectedBlockId(novo.id);
  }

  /**
   * O teste vai para um endereço que se escreve na hora, com `window.prompt`.
   *
   * É a mesma escolha do link do editor partilhado, e pela mesma razão: um
   * modal próprio para escrever um endereço, dentro de um ecrã que já tem três
   * faixas e dois painéis, é uma sobreposição a mais para um campo só. O valor
   * por omissão fica em branco de propósito — sugerir o e-mail de quem está
   * ligado obrigava a trazer a conta ao cliente para ganhar um atalho.
   */
  function enviarTeste() {
    if (!email) return;
    const to = window.prompt(t("sendTestPrompt"));
    if (!to) return;
    run(() => props.onSendTest({ campaignEmailId: email.id, to: to.trim() }));
  }

  function exportarHtml() {
    if (blocks.length === 0) {
      toast(t("canvasEmpty"), "error");
      return;
    }
    startTransition(async () => {
      const result = await props.onPreview({
        blocks,
        subject,
        preheader,
        background: emailBg,
        withData,
      });
      if (result.error || !result.html) {
        toast(result.error ?? t("exportFailed"), "error");
        return;
      }
      // O ficheiro sai do browser: é o HTML que já foi renderizado no servidor,
      // e não há razão para o fazer passar por um endpoint de download.
      const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(name || t("newName"))}.html`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [props.locale],
  );

  // -------------------------------------------------------------------------
  // O ecrã
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button leadingIcon={<Plus size={15} />} disabled={pending} onClick={novaCampanha}>
            {t("new")}
          </Button>
        }
      />

      {props.campaigns.length === 0 ? (
        <Panel>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{t("empty")}</p>
        </Panel>
      ) : null}

      {campaign ? (
        <>
          {/* ------------------------------------------------------------- */}
          {/* Faixa 1 — a campanha                                          */}
          {/* ------------------------------------------------------------- */}
          <Panel label={t("bandCampaign")}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                gap: "var(--sp-4)",
                alignItems: "end",
              }}
            >
              <Select
                label={t("campaignLabel")}
                value={campaign.id}
                options={props.campaigns.map((row) => ({ value: row.id, label: row.name }))}
                onChange={(event) => navegar({ campanha: event.target.value })}
              />
              <Input
                label={t("nameLabel")}
                value={name}
                maxLength={160}
                disabled={locked}
                onChange={(event) => setName(event.target.value)}
              />
              <div style={{ display: "grid", gap: "var(--sp-1)" }}>
                <Select
                  label={t("audienceLabel")}
                  value={audience}
                  disabled={locked}
                  options={CAMPAIGN_AUDIENCES.map((value) => ({
                    value,
                    label: t(`audience.${value}`),
                  }))}
                  onChange={(event) => {
                    const next = event.target.value as CampaignAudience;
                    setAudience(next);
                    setCount(null);
                    startTransition(async () => {
                      const result = await props.onCountAudience(next);
                      setCount(result.count ?? null);
                    });
                  }}
                />
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {count === null ? t("audienceUnknown") : t("audienceCount", { count })}
                </span>
                {/* D69: zero é a resposta certa até o registo recolher o
                    consentimento, e dizê-lo aqui evita que alguém "arranje" o
                    default da coluna. */}
                {count === 0 && audience !== "site_leads_pre" && audience !== "site_leads_post" ? (
                  <span style={{ fontSize: "12px", color: "var(--warn)" }}>
                    {t("audienceConsentNote")}
                  </span>
                ) : null}
              </div>
              <Select
                label={t("senderLabel")}
                hint={t("senderHint")}
                value={fromMailboxId}
                disabled={locked}
                options={[
                  { value: "", label: t("senderNone") },
                  ...props.senders.map((sender) => ({
                    value: sender.id,
                    label: sender.displayName
                      ? `${sender.displayName} · ${sender.address}`
                      : sender.address,
                  })),
                ]}
                onChange={(event) => setFromMailboxId(event.target.value)}
              />
              <div style={{ display: "grid", gap: "var(--sp-1)" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>
                  {t("statusLabel")}
                </span>
                <span>
                  <StatusTag
                    tone={CAMPAIGN_STATUS_TONES[campaign.status as CampaignStatus] as StatusTone}
                  >
                    {t(`status.${campaign.status}`)}
                  </StatusTag>
                </span>
                {campaign.scheduled_at ? (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {dateFormat.format(new Date(campaign.scheduled_at))}
                  </span>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* ------------------------------------------------------------- */}
          {/* Faixa 2 — a sequência                                         */}
          {/* ------------------------------------------------------------- */}
          <Panel label={t("bandSequence")}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "var(--sp-2)",
              }}
            >
              {props.emails.map((row, index) => {
                const active = row.id === email?.id;
                return (
                  <span
                    key={row.id}
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)" }}
                  >
                    {index > 0 ? (
                      <ChevronRight size={14} aria-hidden="true" color="var(--muted)" />
                    ) : null}
                    <Button
                      size="sm"
                      variant={active ? "secondary" : "ghost"}
                      aria-current={active ? "true" : undefined}
                      onClick={() => navegar({ campanha: campaign.id, email: row.id })}
                    >
                      {row.name || t("emailTab", { position: row.position })}
                      {/* A espera de cada e-mail da sequência, à vista no
                          separador: é o que distingue o segundo e-mail de uma
                          sequência de um segundo e-mail qualquer. */}
                      {index > 0 && (props.delayByEmail[row.id] ?? 0) > 0
                        ? ` · +${props.delayByEmail[row.id]}d`
                        : ""}
                    </Button>
                  </span>
                );
              })}
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Plus size={14} />}
                disabled={locked || pending}
                onClick={adicionarEmail}
              >
                {t("addEmail")}
              </Button>
              {props.emails.length > 1 && email ? (
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon={<Trash2 size={14} />}
                  disabled={locked || pending}
                  title={t("removeEmail")}
                  onClick={() =>
                    run(
                      () => props.onDeleteEmail(email.id),
                      () => navegar({ campanha: campaign.id }),
                    )
                  }
                >
                  {t("removeEmail")}
                </Button>
              ) : null}
            </div>
          </Panel>

          {/* ------------------------------------------------------------- */}
          {/* Faixa 3 — o e-mail selecionado                                */}
          {/* ------------------------------------------------------------- */}
          {email ? (
            <Panel label={t("bandEmail")}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                  gap: "var(--sp-4)",
                }}
              >
                <Input
                  label={t("subjectLabel")}
                  value={subject}
                  maxLength={300}
                  disabled={locked}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <Input
                  label={t("preheaderLabel")}
                  hint={t("preheaderHint")}
                  value={preheader}
                  maxLength={300}
                  disabled={locked}
                  onChange={(event) => setPreheader(event.target.value)}
                />
                {/* A espera só existe a partir do segundo: o primeiro e-mail de
                    uma sequência sai quando a campanha sai. */}
                {email.position > 1 ? (
                  <Input
                    label={t("delayLabel")}
                    hint={t("delayHint")}
                    type="number"
                    min={0}
                    max={365}
                    value={String(delayDays)}
                    disabled={locked}
                    onChange={(event) =>
                      setDelayDays(Math.max(0, Math.min(365, Number(event.target.value) || 0)))
                    }
                  />
                ) : null}
              </div>
            </Panel>
          ) : null}

          {/* ------------------------------------------------------------- */}
          {/* Os blocos e o canvas                                          */}
          {/* ------------------------------------------------------------- */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-5)",
              alignItems: "flex-start",
            }}
          >
            {/* A coluna esquerda é `sticky`: o canvas de um e-mail com dez
                blocos é mais alto do que o ecrã, e a paleta tem de estar à mão
                em qualquer ponto dele (04 §2.6). */}
            <aside
              style={{
                position: "sticky",
                top: "var(--sp-4)",
                flex: "1 1 240px",
                maxWidth: "min(100%, 280px)",
                display: "grid",
                gap: "var(--sp-4)",
              }}
            >
              <Panel label={t("blocksLabel")}>
                <div style={{ display: "grid", gap: "var(--sp-1)" }}>
                  {CAMPAIGN_BLOCK_TYPES.map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant="ghost"
                      leadingIcon={BLOCK_ICONS[type]}
                      disabled={locked || !email}
                      onClick={() => inserirBloco(type)}
                    >
                      {t(`blocks.${type}`)}
                    </Button>
                  ))}
                </div>
              </Panel>

              <Panel label={t("styleLabel")}>
                <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <label
                    style={{
                      display: "grid",
                      gap: "var(--sp-1)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {t("backgroundLabel")}
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                      <input
                        type="color"
                        value={emailBg}
                        disabled={locked}
                        onChange={(event) => setEmailBg(event.target.value)}
                        style={{
                          width: "44px",
                          height: "32px",
                          padding: 0,
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-sm)",
                          background: "var(--surface)",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: "12px",
                          fontWeight: 400,
                          color: "var(--muted)",
                        }}
                      >
                        {emailBg}
                      </span>
                    </span>
                  </label>
                  {/* 04 §5.1 proíbe cores fixas; esta é a terceira exceção
                      viva, e a razão está escrita no renderizador — um cliente
                      de e-mail não tem as `custom properties` do design
                      system. O campo é hexadecimal porque a coluna o é. */}
                  <p
                    style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--muted)" }}
                  >
                    {t("backgroundNote")}
                  </p>
                </div>
              </Panel>
            </aside>

            <section
              aria-label={t("canvasLabel")}
              style={{
                flex: "5 1 min(100%, 420px)",
                minWidth: 0,
                display: "grid",
                gap: "var(--sp-3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                }}
              >
                <div
                  role="toolbar"
                  aria-label={t("viewLabel")}
                  style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}
                >
                  <Button
                    size="sm"
                    variant={view === "edit" ? "secondary" : "ghost"}
                    leadingIcon={<Pencil size={14} />}
                    aria-pressed={view === "edit"}
                    onClick={() => setView("edit")}
                  >
                    {t("viewEdit")}
                  </Button>
                  <Button
                    size="sm"
                    variant={view === "desktop" ? "secondary" : "ghost"}
                    leadingIcon={<Monitor size={14} />}
                    aria-pressed={view === "desktop"}
                    onClick={() => setView("desktop")}
                  >
                    {t("viewDesktop")}
                  </Button>
                  <Button
                    size="sm"
                    variant={view === "mobile" ? "secondary" : "ghost"}
                    leadingIcon={<Smartphone size={14} />}
                    aria-pressed={view === "mobile"}
                    onClick={() => setView("mobile")}
                  >
                    {t("viewMobile")}
                  </Button>
                </div>

                {/* O "Com dados" de 04 §2.6. Os valores são uma amostra e não um
                    destinatário real — 07 §24.6 #5 não deixa o Marketing ler a
                    lista, e ir buscar "o primeiro da audiência" era isso por
                    outra porta. */}
                <Toggle label={t("withData")} checked={withData} onCheckedChange={setWithData} />
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {t("variablesHint", {
                    list: CAMPAIGN_VARIABLES.map((name) => `{${name}}`).join(" "),
                  })}
                </span>
              </div>

              {view === "edit" ? (
                <BlockCanvas
                  blocks={blocks}
                  selectedId={selectedBlockId}
                  onSelect={setSelectedBlockId}
                  onChange={setBlocks}
                  senders={props.senders}
                  properties={props.properties}
                  onUploadImage={props.onUploadImage}
                  disabled={locked}
                />
              ) : (
                <div
                  style={{
                    display: "grid",
                    justifyItems: "center",
                    padding: "var(--sp-4)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-lg)",
                    background: "var(--surface2)",
                  }}
                >
                  {/* Um `iframe` e não uma `div`: o HTML de um e-mail traz
                      `<html>`, `<body>` e estilos em linha pensados para um
                      cliente de correio, e injetá-lo na página punha-o a herdar
                      a folha do painel — que é precisamente o que a
                      pré-visualização não pode fazer. É a mesma decisão do
                      leitor de e-mail do Suporte. */}
                  <iframe
                    title={t("previewTitle")}
                    srcDoc={previewHtml}
                    sandbox=""
                    style={{
                      width: `min(100%, ${PREVIEW_WIDTH[view]}px)`,
                      minHeight: "520px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      background: "var(--surface)",
                    }}
                  />
                </div>
              )}
            </section>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* As ações de 04 §2.6                                           */}
          {/* ------------------------------------------------------------- */}
          <Panel label={t("actionsLabel")}>
            <div style={{ display: "grid", gap: "var(--sp-3)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-3)" }}>
                <Button disabled={locked || pending} onClick={guardar}>
                  {pending ? t("saving") : t("save")}
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<Download size={15} />}
                  disabled={pending || blocks.length === 0}
                  onClick={exportarHtml}
                >
                  {t("exportHtml")}
                </Button>
                {/* O teste: pede o endereço e manda-o ao worker, que lê o que
                    está **guardado** — por isso só está disponível depois de
                    gravar, e o `title` di-lo. */}
                <Button
                  variant="secondary"
                  leadingIcon={<Send size={15} />}
                  disabled={pending || !email || blocks.length === 0}
                  title={email ? t("sendTestHint") : t("sendTestNeedsSave")}
                  onClick={enviarTeste}
                >
                  {t("sendTest")}
                </Button>
                <Button
                  variant="secondary"
                  leadingIcon={<Send size={15} />}
                  disabled={locked || pending || campaign.status === "sending"}
                  title={t("sendHint")}
                  onClick={() => {
                    // Uma campanha sai uma vez. A confirmação é por isso, e não
                    // por cautela genérica: não há "desenviar".
                    if (!window.confirm(t("sendConfirm", { name: name || t("newName") }))) return;
                    run(() => props.onSend(campaign.id));
                  }}
                >
                  {t("send")}
                </Button>
                {campaign.status === "draft" ? (
                  <Button
                    variant="secondary"
                    leadingIcon={<Trash2 size={15} />}
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => props.onDeleteCampaign(campaign.id),
                        () => navegar({}),
                      )
                    }
                  >
                    {t("deleteCampaign")}
                  </Button>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  gap: "var(--sp-3)",
                }}
              >
                <Input
                  label={t("scheduleLabel")}
                  type="datetime-local"
                  value={scheduledFor}
                  disabled={locked}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />
                {campaign.status === "scheduled" ? (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => props.onUnschedule(campaign.id))}
                  >
                    {t("unschedule")}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    leadingIcon={<Calendar size={15} />}
                    disabled={locked || pending || !scheduledFor}
                    onClick={() =>
                      run(() =>
                        props.onSchedule({
                          id: campaign.id,
                          at: new Date(scheduledFor).toISOString(),
                        }),
                      )
                    }
                  >
                    {t("schedule")}
                  </Button>
                )}
              </div>

              <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--muted)" }}>
                {t("sendPendingNote")}
              </p>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

/** A moldura de cada faixa e de cada painel — a mesma em todos. */
function Panel({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      style={{
        display: "grid",
        gap: "var(--sp-3)",
        padding: "var(--sp-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
      }}
    >
      {label ? (
        <h2
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {label}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** O nome do ficheiro da exportação. */
function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "campanha"
  );
}
