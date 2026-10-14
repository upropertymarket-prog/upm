"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minus,
  Paperclip,
  Quote,
  Redo2,
  Send,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, useToast } from "@upm/ui";
import type { MailboxOption } from "@upm/db/mail";

import type { MailActionResult } from "./actions";

/**
 * Composer — a janela de escrever (P10-05 · 04 §2.5)
 * =========================================================================
 * 04 §2.5 pede-a no **canto inferior direito**, e é onde está: uma janela que
 * flutua por cima da caixa em vez de uma página à parte. A diferença não é
 * estética — quem responde a um e-mail precisa de ver a mensagem a que está a
 * responder, e uma rota nova tirava-a do ecrã.
 *
 * Três estados, como em qualquer cliente de correio: **normal**, **minimizada**
 * (só a barra de título, para ir buscar uma referência à caixa sem perder o que
 * já escreveu) e **expandida** (quase o ecrã inteiro, para escrever a sério).
 *
 * ## O rascunho grava-se sozinho, e grava por cima
 *
 * Dois segundos depois da última tecla. `mail_save_draft()` devolve o `id` na
 * primeira gravação e o composer guarda-o: a partir daí reescreve **a mesma**
 * linha. Sem isso, uma mensagem escrita em dez minutos deixava dezenas de
 * rascunhos na pasta — e o que se procura depois é o último, não a coleção.
 *
 * ## Porque é `contentEditable` e não o TipTap
 *
 * O TipTap está na stack (02 §3.2) e é o editor dos **contratos**, onde o
 * documento é estruturado, tem variáveis como nós e precisa de serializar para
 * PDF. Um e-mail é HTML simples que vai ser lido por clientes de correio que
 * ignoram metade do que lhes mandamos. `contentEditable` com `execCommand` dá
 * exatamente o que a barra da referência mostra — negrito, itálico, listas,
 * ligação — sem trazer um editor inteiro para dentro do bundle do Suporte.
 * Quando o Composer precisar de blocos (as campanhas vão precisar), a conversa
 * muda; hoje, não precisa.
 *
 * A assinatura entra **no HTML inicial**, separada por um `<hr>`: é texto
 * editável como o resto, porque quem escreve às vezes quer tirá-la — e um
 * bloco intocável obrigaria a um "remover assinatura" que ninguém encontra.
 */

export type ComposerDraft = {
  draftId?: string | null;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  html?: string;
  inReplyTo?: string | null;
};

export type ComposerProps = {
  open: boolean;
  mailboxes: MailboxOption[];
  mailboxId: string;
  signature: string;
  initial?: ComposerDraft;
  onClose: () => void;
  onSave: (input: Record<string, unknown>) => Promise<MailActionResult & { draftId?: string }>;
  onSend: (input: Record<string, unknown>) => Promise<MailActionResult>;
  onDiscard: (draftId: string) => Promise<MailActionResult>;
};

type Size = "normal" | "minimized" | "expanded";

export function Composer(props: ComposerProps) {
  const t = useTranslations("support.mailbox.composer");
  const { toast } = useToast();
  const body = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>("normal");
  const [draftId, setDraftId] = useState<string | null>(props.initial?.draftId ?? null);
  const [to, setTo] = useState((props.initial?.to ?? []).join(", "));
  const [cc, setCc] = useState((props.initial?.cc ?? []).join(", "));
  const [bcc, setBcc] = useState((props.initial?.bcc ?? []).join(", "));
  const [showCc, setShowCc] = useState((props.initial?.cc ?? []).length > 0);
  const [showBcc, setShowBcc] = useState((props.initial?.bcc ?? []).length > 0);
  const [subject, setSubject] = useState(props.initial?.subject ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  // O conteúdo inicial entra uma vez, por `innerHTML`: um `contentEditable`
  // controlado por React perde a posição do cursor a cada tecla.
  useEffect(() => {
    if (!props.open || !body.current) return;
    body.current.innerHTML =
      props.initial?.html ??
      (props.signature ? `<p><br></p><hr />${props.signature}` : "<p><br></p>");
    body.current.focus();
    // A caixa e a assinatura mudam quando se troca de caixa; o conteúdo já
    // escrito, não — daí só reagir à abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // Gravação automática: dois segundos depois da última tecla.
  useEffect(() => {
    if (!dirty || !props.open) return;
    const timer = setTimeout(() => void persist(), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, to, cc, bcc, subject]);

  function payload() {
    return {
      mailboxId: props.mailboxId,
      draftId,
      to: parseAddresses(to),
      cc: parseAddresses(cc),
      bcc: parseAddresses(bcc),
      subject,
      html: body.current?.innerHTML ?? "",
      text: body.current?.innerText ?? "",
      inReplyTo: props.initial?.inReplyTo ?? null,
    };
  }

  async function persist() {
    setSaving(true);
    const result = await props.onSave(payload());
    setSaving(false);
    setDirty(false);
    if (result.draftId) setDraftId(result.draftId);
  }

  function send() {
    startTransition(async () => {
      const result = await props.onSend(payload());
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.notice ?? t("sent"), "success");
      props.onClose();
    });
  }

  function discard() {
    startTransition(async () => {
      if (draftId) await props.onDiscard(draftId);
      props.onClose();
    });
  }

  /**
   * A barra de formatação. `execCommand` está marcado como obsoleto há anos e
   * continua a ser o que todos os browsers implementam para isto; a alternativa
   * é um editor completo, que esta janela não justifica (ver a nota de topo).
   */
  function format(command: string, value?: string) {
    body.current?.focus();
    document.execCommand(command, false, value);
    setDirty(true);
  }

  if (!props.open) return null;

  const mailbox = props.mailboxes.find((box) => box.id === props.mailboxId);

  return (
    <section className="upm-composer" data-size={size} aria-label={t("title")}>
      <header className="upm-composer__bar">
        <strong className="upm-composer__title">{t("title")}</strong>
        <span className="upm-composer__saving">{saving ? t("saving") : null}</span>
        <span className="upm-composer__window">
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label={t("minimize")}
            onClick={() => setSize(size === "minimized" ? "normal" : "minimized")}
          >
            <Minus size={15} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label={t("expand")}
            onClick={() => setSize(size === "expanded" ? "normal" : "expanded")}
          >
            <Maximize2 size={15} />
          </Button>
          <Button size="sm" variant="ghost" iconOnly aria-label={t("close")} onClick={discard}>
            <X size={15} />
          </Button>
        </span>
      </header>

      {size === "minimized" ? null : (
        <>
          <div className="upm-composer__fields">
            <label className="upm-composer__field">
              <span className="upm-composer__label">{t("to")}</span>
              <input
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setDirty(true);
                }}
                placeholder={t("toPlaceholder")}
              />
              <span className="upm-composer__toggles">
                {showCc ? null : (
                  <button type="button" onClick={() => setShowCc(true)}>
                    {t("cc")}
                  </button>
                )}
                {showBcc ? null : (
                  <button type="button" onClick={() => setShowBcc(true)}>
                    {t("bcc")}
                  </button>
                )}
              </span>
            </label>

            {showCc ? (
              <label className="upm-composer__field">
                <span className="upm-composer__label">{t("cc")}</span>
                <input
                  value={cc}
                  onChange={(event) => {
                    setCc(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            ) : null}

            {showBcc ? (
              <label className="upm-composer__field">
                <span className="upm-composer__label">{t("bcc")}</span>
                <input
                  value={bcc}
                  onChange={(event) => {
                    setBcc(event.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            ) : null}

            <label className="upm-composer__field">
              <span className="upm-composer__label">{t("subject")}</span>
              <input
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setDirty(true);
                }}
                placeholder={t("subjectPlaceholder")}
              />
            </label>
          </div>

          <div
            ref={body}
            className="upm-composer__body"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t("bodyLabel")}
            onInput={() => setDirty(true)}
          />

          <div className="upm-composer__toolbar" role="toolbar" aria-label={t("toolbar")}>
            <ToolbarButton label={t("bold")} onClick={() => format("bold")}>
              <Bold size={14} />
            </ToolbarButton>
            <ToolbarButton label={t("italic")} onClick={() => format("italic")}>
              <Italic size={14} />
            </ToolbarButton>
            <ToolbarButton label={t("underline")} onClick={() => format("underline")}>
              <Underline size={14} />
            </ToolbarButton>
            <ToolbarButton label={t("strike")} onClick={() => format("strikeThrough")}>
              <Strikethrough size={14} />
            </ToolbarButton>
            <span className="upm-composer__divider" aria-hidden="true" />
            <ToolbarButton label={t("bullets")} onClick={() => format("insertUnorderedList")}>
              <List size={14} />
            </ToolbarButton>
            <ToolbarButton label={t("numbers")} onClick={() => format("insertOrderedList")}>
              <ListOrdered size={14} />
            </ToolbarButton>
            <ToolbarButton label={t("quote")} onClick={() => format("formatBlock", "blockquote")}>
              <Quote size={14} />
            </ToolbarButton>
            <ToolbarButton
              label={t("link")}
              onClick={() => {
                const url = window.prompt(t("linkPrompt"));
                if (url) format("createLink", url);
              }}
            >
              <Link2 size={14} />
            </ToolbarButton>
            <span className="upm-composer__divider" aria-hidden="true" />
            <ToolbarButton label={t("undo")} onClick={() => format("undo")}>
              <Undo2 size={14} />
            </ToolbarButton>
            <ToolbarButton label={t("redo")} onClick={() => format("redo")}>
              <Redo2 size={14} />
            </ToolbarButton>
          </div>

          <footer className="upm-composer__foot">
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<Paperclip size={15} />}
              disabled
              title={t("attachSoon")}
            >
              {t("attach")}
            </Button>
            <span className="upm-composer__from">
              {t("from")}: {mailbox?.address}
            </span>
            <span className="upm-composer__actions">
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => void persist()}
              >
                {t("saveDraft")}
              </Button>
              <Button size="sm" leadingIcon={<Send size={15} />} disabled={pending} onClick={send}>
                {t("send")}
              </Button>
            </span>
          </footer>
        </>
      )}
    </section>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="upm-composer__tool"
      aria-label={label}
      title={label}
      // `onMouseDown` e não `onClick`: a seleção no corpo perde-se quando o
      // botão ganha foco, e sem seleção o comando não tem a que se aplicar.
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** "ana@x.pt, rui@y.pt" → duas moradas. Vírgula ou ponto e vírgula, como nos clientes de correio. */
export function parseAddresses(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
