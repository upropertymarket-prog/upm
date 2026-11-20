"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, PageHeader } from "@upm/ui";

/**
 * Contrato de adesão — a vista (doc 13)
 * =========================================================================
 * O documento que fixa o negócio concreto de UM subscritor, por oposição aos
 * Termos e Condições, que são as cláusulas gerais iguais para todos.
 *
 * **Recebe tudo já congelado.** Não lê planos, não calcula preços e não vai à
 * base de dados: o contrato tem de dizer o que foi contratado naquele dia, e
 * `plans` é editável no Admin (`savePlan`). Derivar o preço daí faria o contrato
 * reescrever-se sozinho sempre que uma tabela de preços mudasse — é a dívida
 * D58, e esta assinatura de props existe para a tornar impossível de esquecer:
 * quem chamar este componente tem de ter um valor congelado para dar.
 *
 * Mesma razão, aliás, por que a aceitação dos Termos guarda o hash do corpo e
 * não só o número da versão.
 *
 * **O que aqui não está, e porquê.** O botão de descarregar PDF e o e-mail de
 * confirmação em suporte duradouro são Fase 10: dependem do relay (D27) e da
 * exportação, e um botão que não faz nada seria pior do que a ausência dele. A
 * chave `plan.agreement.downloadPdf` já existe e fica à espera.
 */

export type AgreementParty = {
  name: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
};

export type SubscriptionAgreementData = {
  /** Referência do contrato. Formato por decidir — doc 13 §5, decisão 3. */
  reference: string;
  celebratedAt: string;
  provider: AgreementParty;
  subscriber: AgreementParty;
  /** Congelados no momento da celebração, nunca lidos de `plans`. */
  planName: string;
  planFeatures: string[];
  addons: string[];
  /** O que foi efetivamente contratado, na periodicidade escolhida. */
  priceCents: number;
  /** Os dois preços do plano no dia, congelados. Ver `Linha` do preço. */
  priceMonthCents: number;
  priceYearCents: number;
  /**
   * Oferta de entrada congelada (13 nov 2026), na periodicidade contratada.
   * Opcional: os contratos anteriores não a têm, e o canvas também não.
   */
  introPriceCents?: number | null;
  introMonths?: number | null;
  currency: string;
  interval: "month" | "year";
  startedAt: string;
  /** `null` = não definido; `0` = nenhum; `> 0` = meses (P9-03). */
  commitmentMonths: number | null;
  commitmentEndsAt: string | null;
  terms: {
    version: string;
    contentHash: string;
    acceptedAt: string;
    ip: string | null;
    pendingLegalReview: boolean;
  };
  links: { terms: string; privacy: string; cookies: string };
};

function Linha({ termo, children }: { termo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:gap-6">
      <dt className="text-sm text-muted sm:w-56 sm:shrink-0">{termo}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card padded>
      <h2 className="text-sm font-semibold text-text">{titulo}</h2>
      <dl className="mt-2">{children}</dl>
    </Card>
  );
}

export function SubscriptionAgreement({ data }: { data: SubscriptionAgreementData }) {
  const locale = useLocale();
  const t = useTranslations("plan.agreement");

  const date = (value: string) => new Date(value).toLocaleDateString(locale);
  const dateTime = (value: string) => new Date(value).toLocaleString(locale);
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: data.currency }).format(
      cents / 100,
    );

  // O valor em destaque é o que a pessoa paga — mensal em quase todos os casos —
  // e o outro vai entre parêntesis, para a comparação ficar à vista sem ter de
  // multiplicar por doze. Os dois vêm congelados: o anual não é doze vezes o
  // mensal (o registo chama-lhe "dois meses grátis"), e calculá-lo daria um
  // número que ninguém contratou.
  const anual = data.interval === "year";
  const principal = `${money(anual ? data.priceYearCents : data.priceMonthCents)} ${
    anual ? t("perYear") : t("perMonth")
  }`;
  const secundario = `${money(anual ? data.priceMonthCents : data.priceYearCents)} ${
    anual ? t("perMonth") : t("perYear")
  }`;

  const temCompromisso = data.commitmentMonths !== null && data.commitmentMonths > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", {
          reference: data.reference,
          date: date(data.celebratedAt),
        })}
      />

      {data.terms.pendingLegalReview ? (
        <p
          role="note"
          className="rounded-xl border border-border px-4 py-3 text-sm text-text"
          style={{ background: "var(--warn-soft, var(--surface-2))" }}
        >
          {t("draftNotice")}
        </p>
      ) : null}

      <Bloco titulo={t("parties")}>
        <Linha termo={t("provider")}>
          {data.provider.name}
          {data.provider.address ? ` · ${data.provider.address}` : ""}
          {` · ${t("taxId")} ${data.provider.taxId}`}
          {data.provider.email ? ` · ${data.provider.email}` : ""}
          {data.provider.phone ? ` · ${data.provider.phone}` : ""}
        </Linha>
        <Linha termo={t("subscriber")}>
          {data.subscriber.name}
          {` · ${t("taxId")} ${data.subscriber.taxId}`}
          {` · ${data.subscriber.email}`}
        </Linha>
      </Bloco>

      <Bloco titulo={t("object")}>
        <Linha termo={t("planLabel")}>{data.planName}</Linha>
        <Linha termo={t("includes")}>{data.planFeatures.join(" · ")}</Linha>
        <Linha termo={t("addons")}>
          {data.addons.length > 0 ? data.addons.join(" · ") : t("noAddons")}
        </Linha>
      </Bloco>

      <Bloco titulo={t("price")}>
        <Linha termo={t("amount")}>
          <strong>{principal}</strong>{" "}
          <span className="text-muted">
            ({secundario}) · {t("vatIncluded")}
          </span>
        </Linha>
        {data.introPriceCents && data.introMonths ? (
          <Linha termo={t("intro")}>
            {t("introValue", {
              price: `${money(data.introPriceCents)} ${anual ? t("perYear") : t("perMonth")}`,
              months: data.introMonths,
            })}
          </Linha>
        ) : null}
        <Linha termo={t("interval")}>
          {data.interval === "year" ? t("intervalYear") : t("intervalMonth")}
        </Linha>
      </Bloco>

      <Bloco titulo={t("duration")}>
        <Linha termo={t("startedAt")}>{date(data.startedAt)}</Linha>
        <Linha termo={t("commitment")}>
          {temCompromisso
            ? t("commitmentMonths", { months: data.commitmentMonths as number })
            : t("commitmentNone")}
        </Linha>
        {data.commitmentEndsAt ? (
          <Linha termo={t("commitmentEndsAt")}>{date(data.commitmentEndsAt)}</Linha>
        ) : null}
        <Linha termo={t("renewal")}>
          {data.interval === "year" ? t("renewalYear") : t("renewalMonth")}
        </Linha>
      </Bloco>

      <Bloco titulo={t("termination")}>
        <Linha termo={t("termination")}>
          {temCompromisso ? t("terminationWithCommitment") : t("terminationRule")}
        </Linha>
        <Linha termo={t("withdrawal")}>{t("withdrawalText")}</Linha>
      </Bloco>

      <Bloco titulo={t("acceptance")}>
        <Linha termo={t("version")}>{data.terms.version}</Linha>
        <Linha termo={t("hash")}>
          {/* O hash em monoespaçado e quebrável: são 64 caracteres sem espaços,
              e sem `break-all` esticam a linha e dão rolo horizontal. */}
          <code className="break-all font-mono text-[length:var(--fs-body)]">{data.terms.contentHash}</code>
        </Linha>
        <Linha termo={t("acceptedAt")}>{dateTime(data.terms.acceptedAt)}</Linha>
        {data.terms.ip ? <Linha termo={t("ip")}>{data.terms.ip}</Linha> : null}
      </Bloco>

      <Bloco titulo={t("documents")}>
        <Linha termo={t("documentsHint")}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a href={data.links.terms} className="text-accent hover:underline">
              {t("termsLink")}
            </a>
            <span aria-hidden="true">·</span>
            <a href={data.links.privacy} className="text-accent hover:underline">
              {t("privacyLink")}
            </a>
            <span aria-hidden="true">·</span>
            <a href={data.links.cookies} className="text-accent hover:underline">
              {t("cookiesLink")}
            </a>
          </span>
        </Linha>
      </Bloco>
    </div>
  );
}
