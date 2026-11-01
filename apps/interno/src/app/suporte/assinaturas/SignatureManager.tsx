"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Moon, ShieldAlert, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Modal,
  PageHeader,
  Select,
  StatusTag,
  Textarea,
  useTheme,
  useToast,
} from "@upm/ui";
import type { EmailSignatureRow, SignatureFinding, SignatureVariable } from "@upm/db/signatures";
import {
  SIGNATURE_TEMPLATE,
  SIGNATURE_VARIABLES,
  signaturePreviewDocument,
} from "@upm/db/signatures";
import type { MailboxOption } from "@upm/db/mail";

import type { SignatureActionResult } from "./actions";

/**
 * Editor da assinatura — `/suporte/assinaturas` (P10-06 · 04 §2.6)
 * =========================================================================
 * **Uma assinatura para toda a empresa** (29 out 2026). Até aqui havia uma
 * lista de assinaturas, cada uma ligada às suas caixas; o cliente decidiu que
 * todos usam a mesma, e o ecrã ficou com duas colunas: **o HTML** → **como
 * fica**. Sem lista, sem nome, sem caixas e sem "Apagar" — para tirar a
 * assinatura dos e-mails, grava-se o HTML vazio.
 *
 * ## Porque é um editor de código e não um editor rico
 *
 * 04 §2.6 pede "editor HTML com (…) aviso de HTML inseguro". O aviso só faz
 * sentido se houver HTML para avisar sobre — e há: uma assinatura chega quase
 * sempre colada de um designer ou exportada de outro cliente de correio, com
 * tabelas e `style` em linha que nenhum editor rico preserva. Um `contentEditable`
 * (o caminho do Composer, que é o certo **lá**, onde se escreve prosa) reescrevia
 * essa marcação à primeira tecla.
 *
 * ## Os avisos e a pré-visualização vêm do servidor
 *
 * A cada pausa de escrita, uma ida só: o servidor devolve o que o sanitizador
 * vai tirar, as variáveis que não existem, e o HTML limpo já com as variáveis
 * da caixa escolhida resolvidas. Detetar isto no cliente obrigava a trazer o
 * sanitizador para o browser e a mantê-lo igual ao do servidor — e o que
 * divergisse decidia sempre a favor do que não avisa.
 *
 * ## A pré-visualização vive num iframe
 *
 * Mesmo depois de sanitizado, é HTML que alguém colou — e o ecrã que o mostra é
 * um ecrã com sessão de suporte aberta. O `iframe` com `sandbox` é a mesma
 * defesa de 02 §4.3 que o leitor de e-mail usa, e tem um segundo efeito que
 * aqui conta mais: o `style` da assinatura não vaza para a nossa página, nem o
 * nosso para ela. O que se vê é o que o destinatário vai ver.
 */

export type SignatureManagerProps = {
  /** A assinatura da empresa, ou `null` antes da primeira gravação. */
  signature: EmailSignatureRow | null;
  /** Só para a pré-visualização: ver as variáveis com os dados de uma pessoa. */
  mailboxes: MailboxOption[];
  onSave: (
    input: Record<string, unknown>,
  ) => Promise<SignatureActionResult & { id?: string; findings?: SignatureFinding[] }>;
  onInspect: (input: Record<string, unknown>) => Promise<{
    findings: SignatureFinding[];
    preview: string;
    variables: string[];
    error?: string;
  }>;
};

export function SignatureManager(props: SignatureManagerProps) {
  const t = useTranslations("support.signatures");
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  // Antes da primeira gravação, o editor abre no desenho de 04 §2.6 — é o que
  // transforma "escreva HTML" em "mude o que está aqui".
  const [draft, setDraft] = useState(props.signature?.html ?? SIGNATURE_TEMPLATE);
  const [findings, setFindings] = useState<SignatureFinding[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [preview, setPreview] = useState("");
  const [warningsOpen, setWarningsOpen] = useState(false);
  const html = useRef<HTMLTextAreaElement>(null);

  /**
   * O tema da pré-visualização, **independente do da app** (29 out 2026): a
   * assinatura vai parar a caixas de correio claras e escuras, e quem a edita
   * tem de ver as duas sem mudar o tema do ecrã onde trabalha.
   *
   * **Abre no tema da app, e acompanha-o quando ele muda** (1 nov 2026). Abria
   * sempre em claro, e no tema escuro a pré-visualização era um retângulo
   * branco no meio de um ecrã escuro. O seletor continua a trocá-la sozinha.
   */
  const { resolved: appTheme } = useTheme();
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(appTheme);
  useEffect(() => setPreviewTheme(appTheme), [appTheme]);
  const [origin, setOrigin] = useState<string | undefined>(undefined);
  useEffect(() => setOrigin(window.location.origin), []);

  // O editor acompanha a assinatura que recebe, e não só a da primeira
  // montagem. Depois de guardar, a página volta com o HTML **limpo** — sem
  // isto o editor continuava a mostrar o que tinha sido escrito, incluindo o
  // que o sanitizador tirou. E no canvas uma atualização a quente trocava a
  // assinatura sem remontar, e o ecrã ficava com o HTML antigo.
  const savedHtml = props.signature?.html ?? SIGNATURE_TEMPLATE;
  useEffect(() => {
    setDraft(savedHtml);
  }, [savedHtml]);

  /**
   * A caixa que serve de referência à pré-visualização. "Pré-visualização por
   * utilizador" (04 §2.6) quer dizer com os dados do **dono da caixa**: a
   * assinatura é a mesma para toda a empresa, mas o `{{nome}}` é de quem envia.
   * Abre na primeira caixa; sem nenhuma, mostra o HTML com as variáveis à vista
   * — é informação honesta, e não um nome inventado.
   */
  const [previewMailbox, setPreviewMailbox] = useState<string | null>(
    props.mailboxes[0]?.id ?? null,
  );

  // Uma ida ao servidor por pausa de escrita, não por tecla.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await props.onInspect({ html: draft, mailboxId: previewMailbox });
      if (result.error) return;
      setFindings(result.findings);
      setUsed(result.variables);
      setPreview(result.preview);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, previewMailbox]);

  /**
   * Inserir a variável **onde está o cursor**, que é o que 04 §2.6 pede.
   *
   * `setRangeText` e não uma concatenação: a concatenação punha a variável no
   * fim do HTML, que é quase nunca onde se quer. E devolve-se o foco com o
   * cursor depois do que foi inserido, para se poder continuar a escrever sem
   * ir buscar o rato.
   */
  function insertVariable(name: SignatureVariable) {
    const node = html.current;
    if (!node) return;

    const token = `{{${name}}}`;
    const at = node.selectionStart ?? node.value.length;
    node.setRangeText(token, at, node.selectionEnd ?? at, "end");
    setDraft(node.value);
    node.focus();
  }

  function save() {
    startTransition(async () => {
      const result = await props.onSave({ html: draft });

      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.notice ?? t("saved"), "success");
      if (result.findings) setFindings(result.findings);
    });
  }

  const unsafe = findings.filter((finding) => finding.kind === "unsafe");
  const unknown = findings.filter((finding) => finding.kind === "unknownVariable");

  return (
    <div className="upm-sig">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="upm-sig__body">
        {/* ---------------------------------------------------------------- */}
        {/* Coluna 1 — o HTML                                                */}
        {/* ---------------------------------------------------------------- */}
        <section className="upm-sig__editor" aria-label={t("editorLabel")}>
          <div className="upm-sig__variables">
            <span className="upm-sig__muted">{t("variablesTitle")}</span>
            <div className="upm-sig__variable-row">
              {SIGNATURE_VARIABLES.map((name) => (
                <Button
                  key={name}
                  size="sm"
                  variant="secondary"
                  title={t("insertVariable", { name })}
                  onClick={() => insertVariable(name)}
                >
                  {`{{${name}}}`}
                  {used.includes(name) ? <span aria-hidden="true"> ·</span> : null}
                </Button>
              ))}
            </div>
          </div>

          <Textarea
            ref={html}
            label={t("htmlLabel")}
            rows={18}
            spellCheck={false}
            className="upm-sig__code"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          <footer className="upm-sig__actions">
            <Button disabled={pending} onClick={save}>
              {pending ? t("saving") : t("save")}
            </Button>

            {/* Os dois avisos de 04 §2.6, num botão que abre o detalhe num
                modal (28 out 2026): em lista corrida empurravam o editor para
                baixo e, num HTML colado com muitos problemas, ocupavam mais do
                que o próprio código. Na linha do Guardar e encostado à direita
                (29 out 2026): é ali que se olha antes de gravar. Leva a
                contagem e a cor do aviso mais grave, para não se perder de
                vista. */}
            {findings.length > 0 ? (
              <button
                type="button"
                className="upm-sig__warning"
                data-tone={unsafe.length > 0 ? "danger" : "warn"}
                onClick={() => setWarningsOpen(true)}
              >
                {unsafe.length > 0 ? (
                  <ShieldAlert size={15} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={15} aria-hidden="true" />
                )}
                {t("warningsButton", { count: findings.length })}
              </button>
            ) : null}
          </footer>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Coluna 2 — como fica                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="upm-sig__preview" aria-label={t("previewLabel")}>
          <header className="upm-sig__preview-head">
            <span>{t("previewTitle")}</span>
            {previewMailbox ? null : <StatusTag tone="draft">{t("previewRaw")}</StatusTag>}
            {/* O segmentado da topbar, mas com estado próprio: mexe no fundo do
                `iframe`, não no `data-theme` da app. */}
            <div
              className="upm-segmented upm-sig__theme"
              role="radiogroup"
              aria-label={t("previewTheme")}
            >
              {(["light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={previewTheme === option}
                  className="upm-segmented__option"
                  onClick={() => setPreviewTheme(option)}
                >
                  {option === "light" ? (
                    <Sun size={15} aria-hidden="true" />
                  ) : (
                    <Moon size={15} aria-hidden="true" />
                  )}
                  {t(option === "light" ? "previewLight" : "previewDark")}
                </button>
              ))}
            </div>
          </header>
          {props.mailboxes.length > 0 ? (
            <Select
              label={t("previewAs")}
              value={previewMailbox ?? ""}
              onChange={(event) => setPreviewMailbox(event.target.value || null)}
              options={props.mailboxes.map((box) => ({
                value: box.id,
                label: box.displayName ? `${box.displayName} · ${box.address}` : box.address,
              }))}
            />
          ) : null}
          {/* `sandbox` vazio: não corre JavaScript, não submete, não navega o
              pai e não alcança a nossa sessão. `srcDoc` e não `src` pela mesma
              razão do leitor — o conteúdo vem connosco. */}
          <iframe
            className="upm-sig__frame"
            title={t("previewLabel")}
            sandbox=""
            srcDoc={signaturePreviewDocument(preview, previewTheme, origin)}
          />
          <p className="upm-sig__muted">{t("previewNote")}</p>
        </section>
      </div>

      <Modal
        open={warningsOpen && findings.length > 0}
        onClose={() => setWarningsOpen(false)}
        title={t("warningsTitle")}
        subtitle={t("warningsSubtitle")}
        closeLabel={t("warningsClose")}
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setWarningsOpen(false)}>
            {t("warningsClose")}
          </Button>
        }
      >
        <div className="upm-sig__findings">
          {unsafe.length > 0 ? (
            <section className="upm-sig__finding" data-tone="danger">
              <h3>
                <ShieldAlert size={15} aria-hidden="true" />
                {t("unsafeTitle")}
              </h3>
              <p>{t("unsafeBody")}</p>
              <ul>
                {unsafe.map((finding) => (
                  <li key={finding.detail}>
                    <code>{finding.detail}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {unknown.length > 0 ? (
            <section className="upm-sig__finding" data-tone="warn">
              <h3>
                <AlertTriangle size={15} aria-hidden="true" />
                {t("unknownTitle")}
              </h3>
              <p>{t("unknownBody")}</p>
              <ul>
                {unknown.map((finding) => (
                  <li key={finding.detail}>
                    <code>{finding.detail}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
