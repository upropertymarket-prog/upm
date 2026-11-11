"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@upm/ui";

import { Link } from "@/i18n/navigation";

import type { LeadFormState } from "@/lib/leadFormState";
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
 * **Mas com os Termos e a Privacidade** (6 nov 2026, como no site anterior):
 * quem escreve deixa nome e e-mail, e tem de saber, antes de enviar, o que se
 * faz com eles. A caixa é obrigatória e nunca vem marcada, e o servidor
 * recusa sem ela — esconder o botão não chega.
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
  // As frases do consentimento são as da pré-inscrição: o mesmo texto legal
  // num sítio só, para não divergirem.
  const tl = useTranslations("site.preRegistration");

  if (state.ok) {
    return (
      <div
        role="status"
        style={{
          display: "grid",
          gap: "var(--sp-4)",
          justifyItems: "center",
          textAlign: "center",
          padding: "var(--sp-7)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <CheckCircle2 size={28} style={{ color: "var(--ok)" }} aria-hidden="true" />
        <h3 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)", color: "var(--text)" }}>
          {tc("okTitle")}
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
          {tc("okBody")}
        </p>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-5)" }}>
      {/* Honeypot. Nunca remover sem substituir por outra defesa. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="contact-website">{tc("honeypot")}</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Input
        label={tc("name")}
        name="name"
        autoComplete="name"
        required
        error={state.fieldErrors?.name}
      />

      <Input
        label={tc("email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />

      <Select
        label={tc("reasonLabel")}
        name="reason"
        defaultValue=""
        error={state.fieldErrors?.reason}
        options={[
          { value: "", label: tc("pickOption") },
          ...CONTACT_REASON_VALUES.map((value) => ({ value, label: tc(`reasons.${value}`) })),
        ]}
      />

      <Textarea
        label={tc("message")}
        name="message"
        rows={5}
        hint={tc("messageHint")}
        error={state.fieldErrors?.message}
      />

      <Field label={tl("consents")} error={state.fieldErrors?.consentTerms}>
        {({ describedBy, invalid }) => (
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
              {tl("acceptPrefix")} <Link href="/termos">{tl("terms")}</Link> {tl("acceptMiddle")}{" "}
              <Link href="/privacidade">{tl("privacy")}</Link>.
            </span>
          </label>
        )}
      </Field>

      {state.error ? (
        <p role="alert" style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--danger)" }}>
          {state.error}
        </p>
      ) : null}

      {/* Mínimo de 16 px do texto ao CTA (cliente, 11 nov 2026): os 12 px do
          `gap` do formulário colavam o botão aos consentimentos. */}
      <div style={{ marginTop: "4px" }}>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? tc("sending") : tc("send")}
        </Button>
      </div>
    </form>
  );
}
