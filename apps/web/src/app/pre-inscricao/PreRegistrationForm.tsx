"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button, Field, Input, Select } from "@upm/ui";

import type { LeadFormState } from "./leadFormState";

/**
 * Formulário de pré-inscrição (P2-02 · 04 §2.1)
 * =========================================================================
 * Perfil, nome, e-mail, zona e consentimentos — a lista de 04 §2.1, e nada
 * mais. Cada campo a mais num formulário público é uma pessoa a menos a
 * chegar ao fim.
 *
 * **Dois consentimentos, separados e nenhum pré-selecionado** (P11-07 é
 * explícito: "sem caixas pré-selecionadas"). Os Termos são obrigatórios — é
 * o que autoriza o tratamento; o marketing é opcional e tem de o ser, senão
 * não é consentimento.
 *
 * O campo `website` é o honeypot: fora do ecrã para quem vê, invisível para
 * leitores de ecrã por `aria-hidden`, e com `tabIndex={-1}` para o teclado
 * não lá cair. Um humano nunca o preenche.
 */
export type PreRegistrationFormProps = {
  /** A Server Action, injetada. Importá-la aqui arrastava `next/headers`
   *  para dentro do componente e tornava-o irrenderizável no canvas — foi o
   *  `canvas_validate` que o apanhou (server_component_import). */
  onSubmit: (previous: LeadFormState, formData: FormData) => Promise<LeadFormState>;
};

export function PreRegistrationForm({ onSubmit }: PreRegistrationFormProps) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(onSubmit, {});

  if (state.ok) {
    return (
      <div
        role="status"
        style={{
          display: "grid",
          gap: "var(--sp-4)",
          justifyItems: "center",
          textAlign: "center",
          padding: "var(--sp-7) var(--sp-5)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <CheckCircle2 size={28} style={{ color: "var(--ok)" }} aria-hidden="true" />
        <h2 style={{ margin: 0, fontSize: "18px", color: "var(--text)" }}>
          {state.alreadyConfirmed ? "Já está inscrito" : "Pré-inscrição recebida"}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.6,
            color: "var(--muted)",
            maxWidth: "28rem",
          }}
        >
          {state.alreadyConfirmed
            ? "Este endereço já tinha a inscrição confirmada. Avisamos assim que os primeiros anúncios abrirem."
            : "Enviámos-lhe um e-mail para confirmar o endereço. A inscrição fica completa quando clicar no link."}
        </p>
        <Link href="/" className="upm-btn upm-btn--secondary upm-btn--md">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-5)" }}>
      {/* Honeypot. Nunca remover sem substituir por outra defesa. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="website">Não preencher</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Select
        label="O que o descreve?"
        name="profileType"
        defaultValue=""
        error={state.fieldErrors?.profileType}
        options={[
          { value: "", label: "Selecione uma opção…" },
          { value: "owner", label: "Tenho uma propriedade para vender ou arrendar" },
          { value: "buyer", label: "Procuro casa" },
          { value: "empresa", label: "Represento uma empresa" },
        ]}
      />

      <Input
        label="Nome"
        name="name"
        autoComplete="name"
        required
        error={state.fieldErrors?.name}
      />

      <Input
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />

      <Input
        label="Zona de interesse"
        name="zone"
        hint="Opcional. Ajuda-nos a saber por onde começar."
        autoComplete="address-level2"
      />

      <Field label="Consentimentos" error={state.fieldErrors?.consentTerms}>
        {({ describedBy, invalid }) => (
          <div style={{ display: "grid", gap: "var(--sp-3)" }}>
            <label
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                alignItems: "start",
                fontSize: "var(--fs-body)",
              }}
            >
              <input
                type="checkbox"
                name="consentTerms"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                style={{ marginTop: "3px", flexShrink: 0 }}
              />
              <span>
                Li e aceito os <Link href="/termos">Termos e Condições</Link> e a{" "}
                <Link href="/privacidade">Política de Privacidade</Link>.
              </span>
            </label>
            <label
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                alignItems: "start",
                fontSize: "var(--fs-body)",
              }}
            >
              <input
                type="checkbox"
                name="consentMarketing"
                style={{ marginTop: "3px", flexShrink: 0 }}
              />
              <span style={{ color: "var(--muted)" }}>
                Quero receber novidades sobre o lançamento. Pode cancelar a qualquer momento.
              </span>
            </label>
          </div>
        )}
      </Field>

      {state.error ? (
        <p role="alert" style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--danger)" }}>
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "A enviar…" : "Quero ser avisado"}
        </Button>
      </div>
    </form>
  );
}
