"use client";

import { useEffect, useState, useTransition } from "react";
import { Maximize2, Minus, Paperclip, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, useToast } from "@upm/ui";
import { RichText, richTextLabels } from "@upm/ui/editor";
import type { MailboxOption } from "@upm/db/mail";

import type { MailActionResult } from "./actions";
import { htmlToText, parseAddresses } from "./mail-text";

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
 * ## O corpo é o `RichText` partilhado (desde 14 out 2026)
 *
 * Esta janela nasceu com `contentEditable` + `execCommand`, e a nota que aqui
 * estava defendia-o: "um e-mail é HTML simples, não vale um editor inteiro".
 * Deixou de se defender quando as Novidades repetiram o mesmo ficheiro e as
 * Campanhas iam repetir o terceiro — e, sobretudo, porque `execCommand` é uma
 * API obsoleta que cada browser implementa à sua maneira, no editor que o
 * Suporte usa o dia inteiro para responder a clientes.
 *
 * O corpo passou a ser `@upm/ui/editor`, em TipTap. **A janela não mudou**: os
 * três tamanhos, o rascunho automático de dois segundos, os campos e os botões
 * são os mesmos. O que mudou é quem desenha o corpo e a barra — que continua no
 * fim, junto à linha dos botões, como 04 §2.5 pede.
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
  // As etiquetas da barra vivem em `editor.*`: passaram a ser de três ecrãs.
  const tRoot = useTranslations();
  const { toast } = useToast();
  const [html, setHtml] = useState("");
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

  /**
   * O conteúdo inicial entra **uma vez por abertura**, e é o `resetKey` do
   * `RichText` que o garante. Antes isto era um `innerHTML` a seco num
   * `contentEditable`, com um comentário a explicar que um editor controlado
   * por React perdia o cursor a cada tecla; o `RichText` guarda o seu próprio
   * estado e a reposição passou a ter uma porta com nome.
   *
   * A caixa e a assinatura mudam quando se troca de caixa; o conteúdo já
   * escrito, não — daí a chave contar as aberturas e não seguir `props`.
   */
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    if (!props.open) return;
    setHtml(
      props.initial?.html ??
        (props.signature ? `<p><br></p><hr />${props.signature}` : "<p><br></p>"),
    );
    setOpened((count) => count + 1);
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
      html,
      // A versão em texto do que vai no corpo. Era o `innerText` do
      // `contentEditable`; agora sai do HTML, no servidor é que não — o
      // destinatário recebe as duas partes e a de texto é a que um cliente
      // sem HTML mostra.
      text: htmlToText(html),
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

          {/* O corpo e a barra, agora do editor partilhado. A barra fica no
              fim junto aos botoes, como 04 §2.5 pede ("toolbar no fim junto a
              linha") — e e por isso que o RichText tem toolbarPosition. */}
          <RichText
            className="upm-composer__body"
            label={t("bodyLabel")}
            value={html}
            onChange={(next) => {
              setHtml(next);
              setDirty(true);
            }}
            labels={richTextLabels(tRoot)}
            resetKey={opened}
            toolbarPosition="bottom"
            minHeight={160}
          />

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
