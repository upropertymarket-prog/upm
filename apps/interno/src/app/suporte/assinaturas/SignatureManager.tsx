"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Mail, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  EmptyState,
  Input,
  PageHeader,
  StatusTag,
  Textarea,
  useToast,
} from "@upm/ui";
import type { EmailSignatureRow, SignatureFinding, SignatureVariable } from "@upm/db/signatures";
import { SIGNATURE_TEMPLATE, SIGNATURE_VARIABLES } from "@upm/db/signatures";
import type { MailboxOption } from "@upm/db/mail";

import type { SignatureActionResult } from "./actions";

/**
 * Editor de assinaturas — `/suporte/assinaturas` (P10-06 · 04 §2.6)
 * =========================================================================
 * Três colunas de leitura, como a caixa de e-mail ao lado: **quais há** →
 * **o HTML** → **como fica**. O ecrã inteiro é a tarefa, por isso o
 * `PageHeader` fica e o resto enche o que sobra.
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
  signatures: EmailSignatureRow[];
  mailboxes: MailboxOption[];
  onSave: (
    input: Record<string, unknown>,
  ) => Promise<SignatureActionResult & { id?: string; findings?: SignatureFinding[] }>;
  onDelete: (id: string) => Promise<SignatureActionResult>;
  onInspect: (input: Record<string, unknown>) => Promise<{
    findings: SignatureFinding[];
    preview: string;
    variables: string[];
    error?: string;
  }>;
};

/** `null` = a criar; uma string = a editar aquela. */
type Editing = { id: string | null; name: string; html: string; mailboxIds: string[] };

function draftOf(signature: EmailSignatureRow): Editing {
  return {
    id: signature.id,
    name: signature.name,
    html: signature.html,
    mailboxIds: signature.mailbox_ids,
  };
}

export function SignatureManager(props: SignatureManagerProps) {
  const t = useTranslations("support.signatures");
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [draft, setDraft] = useState<Editing | null>(
    props.signatures[0] ? draftOf(props.signatures[0]) : null,
  );
  const [findings, setFindings] = useState<SignatureFinding[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [preview, setPreview] = useState("");
  const html = useRef<HTMLTextAreaElement>(null);

  /**
   * A caixa que serve de referência à pré-visualização. É a primeira associada
   * — "pré-visualização por utilizador" (04 §2.6) quer dizer com os dados do
   * **dono da caixa**, e quem escolhe as caixas é esta assinatura. Sem nenhuma
   * associada, mostra-se o HTML com as variáveis à vista: é informação honesta,
   * e não um nome inventado.
   */
  const previewMailbox = draft?.mailboxIds[0] ?? null;

  // Uma ida ao servidor por pausa de escrita, não por tecla.
  useEffect(() => {
    if (!draft) {
      setFindings([]);
      setPreview("");
      return;
    }
    const timer = setTimeout(async () => {
      const result = await props.onInspect({ html: draft.html, mailboxId: previewMailbox });
      if (result.error) return;
      setFindings(result.findings);
      setUsed(result.variables);
      setPreview(result.preview);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.html, previewMailbox]);

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
    if (!node || !draft) return;

    const token = `{{${name}}}`;
    const at = node.selectionStart ?? node.value.length;
    node.setRangeText(token, at, node.selectionEnd ?? at, "end");
    setDraft({ ...draft, html: node.value });
    node.focus();
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const result = await props.onSave({
        id: draft.id,
        name: draft.name,
        html: draft.html,
        mailboxIds: draft.mailboxIds,
      });

      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.notice ?? t("saved"), "success");
      // O `id` da linha que acabou de nascer: sem o guardar, a segunda gravação
      // criava uma segunda assinatura em vez de reescrever a primeira.
      if (result.id) setDraft({ ...draft, id: result.id });
      if (result.findings) setFindings(result.findings);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await props.onDelete(id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.notice ?? t("deleted"), "success");
      setDraft(null);
    });
  }

  const unsafe = findings.filter((finding) => finding.kind === "unsafe");
  const unknown = findings.filter((finding) => finding.kind === "unknownVariable");

  return (
    <div className="upm-sig">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            leadingIcon={<Plus size={15} />}
            onClick={() =>
              setDraft({ id: null, name: t("newName"), html: SIGNATURE_TEMPLATE, mailboxIds: [] })
            }
          >
            {t("new")}
          </Button>
        }
      />

      <div className="upm-sig__body">
        {/* ---------------------------------------------------------------- */}
        {/* Coluna 1 — quais há                                              */}
        {/* ---------------------------------------------------------------- */}
        <aside className="upm-sig__list" aria-label={t("listLabel")}>
          {props.signatures.length === 0 ? (
            <p className="upm-sig__muted">{t("empty")}</p>
          ) : (
            <ul>
              {props.signatures.map((signature) => {
                const boxes = props.mailboxes.filter((box) =>
                  signature.mailbox_ids.includes(box.id),
                );
                return (
                  <li key={signature.id}>
                    <button
                      type="button"
                      className="upm-sig__item"
                      aria-current={draft?.id === signature.id ? "true" : undefined}
                      onClick={() => setDraft(draftOf(signature))}
                    >
                      <span className="upm-sig__item-name">{signature.name}</span>
                      <span className="upm-sig__item-meta">
                        {boxes.length > 0
                          ? boxes.map((box) => box.address).join(", ")
                          : t("noMailbox")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Coluna 2 — o HTML                                                */}
        {/* ---------------------------------------------------------------- */}
        {draft ? (
          <section className="upm-sig__editor" aria-label={t("editorLabel")}>
            <Input
              label={t("nameLabel")}
              value={draft.name}
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />

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
              value={draft.html}
              onChange={(event) => setDraft({ ...draft, html: event.target.value })}
            />

            {/* Os dois avisos de 04 §2.6. Ficam juntos ao editor e não junto ao
                botão de gravar: é no HTML que se corrigem. */}
            {unsafe.length > 0 ? (
              <p className="upm-sig__warning" data-tone="danger" role="alert">
                <ShieldAlert size={15} aria-hidden="true" />
                {t("unsafeWarning", { list: unsafe.map((finding) => finding.detail).join(", ") })}
              </p>
            ) : null}
            {unknown.length > 0 ? (
              <p className="upm-sig__warning" data-tone="warn" role="alert">
                <AlertTriangle size={15} aria-hidden="true" />
                {t("unknownWarning", { list: unknown.map((finding) => finding.detail).join(", ") })}
              </p>
            ) : null}

            <fieldset className="upm-sig__mailboxes">
              <legend className="upm-sig__muted">{t("mailboxesTitle")}</legend>
              {props.mailboxes.length === 0 ? (
                <p className="upm-sig__muted">{t("noMailboxes")}</p>
              ) : (
                props.mailboxes.map((box) => (
                  <Checkbox
                    key={box.id}
                    label={`${box.displayName || box.address} · ${box.address}`}
                    checked={draft.mailboxIds.includes(box.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        mailboxIds: event.target.checked
                          ? [...draft.mailboxIds, box.id]
                          : draft.mailboxIds.filter((id) => id !== box.id),
                      })
                    }
                  />
                ))
              )}
            </fieldset>

            <footer className="upm-sig__actions">
              <Button disabled={pending} onClick={save}>
                {pending ? t("saving") : t("save")}
              </Button>
              {draft.id ? (
                <Button
                  variant="secondary"
                  leadingIcon={<Trash2 size={15} />}
                  disabled={pending}
                  onClick={() => remove(draft.id!)}
                >
                  {t("delete")}
                </Button>
              ) : null}
            </footer>
          </section>
        ) : (
          <section className="upm-sig__editor upm-sig__editor--empty">
            <EmptyState
              icon={<Mail size={22} />}
              title={t("pickTitle")}
              description={t("pickBody")}
            />
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Coluna 3 — como fica                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="upm-sig__preview" aria-label={t("previewLabel")}>
          <header className="upm-sig__preview-head">
            <span>{t("previewTitle")}</span>
            {previewMailbox ? (
              <StatusTag tone="active">
                {props.mailboxes.find((box) => box.id === previewMailbox)?.address ?? ""}
              </StatusTag>
            ) : (
              <StatusTag tone="draft">{t("previewRaw")}</StatusTag>
            )}
          </header>
          {/* `sandbox` vazio: não corre JavaScript, não submete, não navega o
              pai e não alcança a nossa sessão. `srcDoc` e não `src` pela mesma
              razão do leitor — o conteúdo vem connosco. */}
          <iframe
            className="upm-sig__frame"
            title={t("previewLabel")}
            sandbox=""
            srcDoc={preview}
          />
          <p className="upm-sig__muted">{t("previewNote")}</p>
        </section>
      </div>
    </div>
  );
}
