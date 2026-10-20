import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { myAgreements } from "@upm/db/agreement";
import { isPendingLegalReview, currentLegalDocument } from "@upm/db/legal";

import { AppChrome } from "../../../components/AppChrome";
import { SubscriptionAgreement } from "../../../components/billing/SubscriptionAgreement";
import {
  countersFor,
  loadConversations,
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../../lib/interaction";
import { setLocalePreference } from "../../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Contrato de adesão — `/plano/contrato` (doc 13, D58)
 * =========================================================================
 * O contrato concreto do titular: o que contratou, quando, a que preço e com
 * que versão dos Termos. Lê `subscription_agreements`, que guarda tudo
 * **congelado** no dia da celebração — nunca `plans`, que o Admin edita.
 *
 * `?id=` abre um contrato anterior. Sem parâmetro mostra o mais recente, que é
 * o que está em vigor.
 */
export default async function ContratoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }, params] = await Promise.all([
    getLocale(),
    supabase.auth.getUser(),
    searchParams,
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "owner" && profile.role !== "buyer")) redirect("/");

  const role = profile.role;

  // `tax_id` entrou em P9-01. É dado pessoal: lê-se só a linha da sessão e não
  // sai daqui para props de cliente além do contrato do próprio titular.
  const { data: identity } = await supabase
    .from("profiles")
    .select("tax_id")
    .eq("id", user.id)
    .maybeSingle();

  const [agreements, t, conversations, visits, leads, notifications] = await Promise.all([
    myAgreements(supabase),
    getTranslations("plan.agreement"),
    loadConversations(supabase),
    loadVisits(supabase),
    role === "owner" ? loadLeads(supabase) : Promise.resolve([]),
    loadNotifications(supabase, locale),
  ]);

  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const wanted = one(params.id);
  const agreement = wanted ? agreements.find((row) => row.id === wanted) : agreements[0];

  // O aviso de minuta sai do documento publicado, não de uma constante: quando
  // a revisão jurídica entrar, desaparece sozinho.
  const document = agreement?.terms.version
    ? await currentLegalDocument(supabase, "terms", locale)
    : null;

  const chrome = {
    role,
    userName: profile.full_name || (role === "owner" ? "Proprietário" : "Comprador"),
    userMeta: role === "owner" ? "Proprietário" : "Comprador",
    activeId: "plan" as const,
    locale,
    onLocaleChange: setLocalePreference,
    counters: countersFor(role, conversations, visits, leads),
    notifications,
  };

  if (!agreement) {
    return (
      <AppChrome {...chrome}>
        <main className="mx-auto w-full max-w-3xl px-4 py-16">
          <h1 className="text-xl font-semibold text-text">{t("title")}</h1>
          <p className="mt-4 text-sm text-muted">{t("empty")}</p>
        </main>
      </AppChrome>
    );
  }

  const webUrl = process.env.WEB_URL ?? "http://localhost:4300";

  return (
    <AppChrome {...chrome}>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <SubscriptionAgreement
          data={{
            reference: agreement.reference,
            celebratedAt: agreement.celebratedAt,
            provider: {
              name: agreement.provider.name || "[NOME LEGAL DA EMPRESA]",
              taxId: agreement.provider.tax_id || "[NIPC]",
              email: agreement.provider.email || "[E-MAIL DE CONTACTO]",
              phone: agreement.provider.phone || "[TELEFONE]",
              address: agreement.provider.address || "[MORADA]",
            },
            subscriber: {
              name: profile.full_name ?? "",
              taxId: identity?.tax_id ?? "",
              // O e-mail vive em `auth.users`, não em `profiles`.
              email: user.email ?? "",
            },
            planName: agreement.planName,
            planFeatures: agreement.planFeatures,
            addons: agreement.addons.map((addon) => addon.name),
            priceCents: agreement.priceCents,
            priceMonthCents: agreement.priceMonthCents,
            priceYearCents: agreement.priceYearCents,
            currency: agreement.currency,
            interval: agreement.interval,
            startedAt: agreement.celebratedAt,
            commitmentMonths: agreement.commitmentMonths,
            commitmentEndsAt: agreement.commitmentEndsAt,
            terms: {
              version: agreement.terms.version ?? "—",
              contentHash: agreement.terms.contentHash ?? "—",
              acceptedAt: agreement.terms.acceptedAt ?? agreement.celebratedAt,
              ip: agreement.terms.ip,
              pendingLegalReview: document ? isPendingLegalReview(document) : false,
            },
            links: {
              terms: `${webUrl}/termos`,
              privacy: `${webUrl}/privacidade`,
              cookies: `${webUrl}/cookies`,
            },
          }}
        />

        {agreements.length > 1 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-text">{t("previous")}</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {agreements
                .filter((row) => row.id !== agreement.id)
                .map((row) => (
                  <li key={row.id} className="text-sm">
                    <a
                      href={`/plano/contrato?id=${row.id}`}
                      className="text-accent hover:underline"
                    >
                      {row.reference}
                    </a>{" "}
                    <span className="text-muted">
                      · {new Date(row.celebratedAt).toLocaleDateString(locale)} · {row.planName}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
      </main>
    </AppChrome>
  );
}
