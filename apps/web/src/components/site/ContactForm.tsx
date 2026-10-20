"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button, Input, Select, Textarea } from "@upm/ui";

import type { LeadFormState } from "../../app/pre-inscricao/leadFormState";
import { CONTACT_REASON_VALUES } from "../../lib/site-content";

/**
 * Formulário de contacto da home (P2-02 · 04 §2.1 · fecha a secção `#contactos`)
 * =========================================================================
 * Até 8 out 2026 a secção "Contactos" era um parágrafo a dizer que o
 * formulário vinha depois, com um endereço de e-mail entretanto. A action
 * `submitContact` já existia e já escrevia em `site_leads` com honeypot, rate
 * limit por IP e dedupe — faltava só a superfície.
 *
 * Nome, e-mail, motivo e mensagem: exatamente os campos que `contactSchema`
 * aceita em `pre-inscricao/actions.ts`, nem mais um. O motivo é o que o CRM do
 * Admin filtra (04 §2.5, "Leads do site"), e por isso é um `<Select>` fechado e
 * não texto livre.
 *
 * **Sem consentimento de marketing**, ao contrário da pré-inscrição: quem
 * escreve uma pergunta não está a subscrever nada, e a action já envia
 * `consent_marketing = false`. Pedi-lo aqui seria arrancar um consentimento a
 * quem só quer uma resposta.
 *
 * O campo `website` é o honeypot, no mesmo desenho do `PreRegistrationForm`:
 * fora do ecrã, `aria-hidden`, `tabIndex={-1}`. Um humano nunca lá chega.
 */
export type ContactFormProps = {
  /** A Server Action, injetada — importá-la aqui arrastava `next/headers` para
   *  dentro do componente e tornava-o irrenderizável no canvas. É a mesma
   *  razão que está escrita no `PreRegistrationForm`. */
  onSubmit: (previous: LeadFormState, formData: FormData) => Promise<LeadFormState>;
};

export function ContactForm({ onSubmit }: ContactFormProps) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(onSubmit, {});
  const tc = useTranslations("site.contact");

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
        <h3 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)", color: "var(--text)" }}>
          Mensagem recebida
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-body)",
            lineHeight: 1.6,
            color: "var(--muted)",
            maxWidth: "28rem",
          }}
        >
          Obrigado pelo contacto. Respondemos para o endereço que indicou, por ordem de chegada.
        </p>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-5)" }}>
      {/* Honeypot. Nunca remover sem substituir por outra defesa. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="contact-website">Não preencher</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

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

      <Select
        label="Motivo do contacto"
        name="reason"
        defaultValue=""
        error={state.fieldErrors?.reason}
        options={[
          { value: "", label: "Selecione uma opção…" },
          ...CONTACT_REASON_VALUES.map((value) => ({ value, label: tc(`reasons.${value}`) })),
        ]}
      />

      <Textarea
        label="Mensagem"
        name="message"
        rows={5}
        hint="Opcional. Quanto mais contexto der, mais útil é a resposta."
        error={state.fieldErrors?.message}
      />

      {state.error ? (
        <p role="alert" style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--danger)" }}>
          {state.error}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "A enviar…" : "Enviar mensagem"}
        </Button>
      </div>
    </form>
  );
}
