"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";

import { Button } from "../components/Button";
import { Textarea } from "../components/Input";
import { Modal } from "../components/Overlay";
import { captureTechnicalSnapshot, type TechnicalSnapshot } from "./breadcrumbs";

/**
 * Reportar problema — modal (P10-01 · 04 §2.7 #1)
 * =========================================================================
 * O botão existe nos quatro perfis desde a Fase 1, no rodapé da sidebar, e até
 * hoje não fazia nada (`onReport: () => undefined`). Este é o ecrã que faltava.
 *
 * **O utilizador escreve uma coisa só.** 04 §2.7 #1 é explícito: "o utilizador
 * só escreve a descrição e anexa captura (opcional)". Não há campo de título,
 * não há seletor de gravidade e não há escolha de categoria — o título sai da
 * descrição e a gravidade é sugerida pelo servidor (`suggest_ticket_severity`).
 * Pedir a quem está irritado com um problema que o classifique é pedir-lhe
 * trabalho que o Suporte faz melhor.
 *
 * **O que se mostra sobre a captura técnica.** O resumo é visível antes de
 * enviar, e não escondido atrás de um "enviamos dados de diagnóstico": quem
 * reporta tem direito a saber o que vai com o relato. É também o que torna
 * verificável a promessa de 04 §2.7 #2 — nunca conteúdo de mensagens ou
 * documentos.
 *
 * Modal ao centro, e não drawer: 04 §1.4 reserva o modal para "tarefas curtas
 * e decisões" e nomeia "reportar problema" entre elas.
 */

export type ReportProblemLabels = {
  title: string;
  subtitle: string;
  descriptionLabel: string;
  descriptionHint: string;
  descriptionPlaceholder: string;
  attach: string;
  attachRemove: string;
  technicalTitle: string;
  technicalNote: string;
  submit: string;
  cancel: string;
  sending: string;
  successTitle: string;
  successBody: string;
  mergedBody: string;
  close: string;
  tooShort: string;
  fileTooLarge: string;
  fileWrongType: string;
};

export type ReportProblemSubmit = (payload: {
  description: string;
  snapshot: TechnicalSnapshot;
  screenshot: File | null;
}) => Promise<{ ref: string; merged: boolean } | { error: string }>;

export type ReportProblemModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: ReportProblemSubmit;
  labels: ReportProblemLabels;
  /** Igual ao limite do bucket `ticket-screenshots`. */
  maxScreenshotBytes?: number;
};

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MIN_DESCRIPTION = 10;

export function ReportProblemModal({
  open,
  onClose,
  onSubmit,
  labels,
  maxScreenshotBytes = 5 * 1024 * 1024,
}: ReportProblemModalProps) {
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ref: string; merged: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState<TechnicalSnapshot>({});
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  // O retrato tira-se **ao abrir**, não ao submeter: entre abrir o modal e
  // escrever a descrição, a rota não muda mas a trilha de cliques passa a
  // incluir os cliques dentro do próprio modal — que não interessam a ninguém.
  useEffect(() => {
    if (!open) return;
    setSnapshot(captureTechnicalSnapshot(process.env.NEXT_PUBLIC_BUILD_SHA));
  }, [open]);

  // Reset ao fechar, e não ao abrir: quem fecha por engano e reabre no mesmo
  // instante perderia o que escreveu se fosse ao abrir.
  function close() {
    onClose();
    setDescription("");
    setScreenshot(null);
    setError(null);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError(labels.fileWrongType);
      return;
    }
    if (file.size > maxScreenshotBytes) {
      setError(labels.fileTooLarge);
      return;
    }
    setError(null);
    setScreenshot(file);
  }

  function submit() {
    if (description.trim().length < MIN_DESCRIPTION) {
      setError(labels.tooShort);
      return;
    }
    setError(null);
    startTransition(async () => {
      const outcome = await onSubmit({ description: description.trim(), snapshot, screenshot });
      if ("error" in outcome) {
        setError(outcome.error);
        return;
      }
      setResult(outcome);
    });
  }

  if (result) {
    return (
      <Modal
        open={open}
        onClose={close}
        title={labels.successTitle}
        subtitle={result.ref}
        closeLabel={labels.close}
        footer={
          <Button variant="secondary" onClick={close}>
            {labels.close}
          </Button>
        }
      >
        <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.55, margin: 0 }}>
          {result.merged ? labels.mergedBody : labels.successBody}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={labels.title}
      subtitle={labels.subtitle}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? labels.sending : labels.submit}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-6)" }}>
        <Textarea
          label={labels.descriptionLabel}
          hint={labels.descriptionHint}
          placeholder={labels.descriptionPlaceholder}
          value={description}
          rows={5}
          maxLength={5000}
          error={error ?? undefined}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap" }}
        >
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(",")}
            hidden
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Paperclip size={15} />}
            onClick={() => fileInput.current?.click()}
            disabled={pending}
          >
            {labels.attach}
          </Button>
          {screenshot ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--sp-2)",
                fontSize: "13px",
                color: "var(--muted)",
                minWidth: 0,
              }}
            >
              <span
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={screenshot.name}
              >
                {screenshot.name}
              </span>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                aria-label={labels.attachRemove}
                onClick={() => {
                  setScreenshot(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <X size={14} />
              </Button>
            </span>
          ) : null}
        </div>

        {/* O que vai com o relato — dito, não despejado.
            Esta caixa listava os valores recolhidos (`route`, `viewport`,
            `browser`, `os`, `network`, contagem de `breadcrumbs`). Saíram a 28
            out 2026: quem reporta um problema não precisa de ler a sua própria
            resolução de ecrã para confiar no que envia, e a lista empurrava os
            botões para fora do primeiro ecrã do modal. O que a pessoa precisa
            de saber é o que a nota diz — que vai contexto do ecrã e nunca o
            conteúdo do que escreveu. O `snapshot` continua a seguir inteiro no
            `onSubmit`; o que mudou foi mostrá-lo. */}
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "var(--sp-5)",
            display: "grid",
            gap: "var(--sp-3)",
          }}
        >
          <strong style={{ fontSize: "13px", color: "var(--text)" }}>
            {labels.technicalTitle}
          </strong>
          <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
            {labels.technicalNote}
          </p>
        </div>
      </div>
    </Modal>
  );
}
