import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { listTemplates } from "@upm/db/message-templates";

import { InternalChrome } from "../../../components/InternalChrome";
import { getMarketingShellData } from "../../../lib/marketing-shell";
import { setLocalePreference } from "../../actions/preferences";
import { deleteTemplateAction, saveTemplateAction } from "./actions";
import { TemplateManager } from "./TemplateManager";

/**
 * `/marketing/modelos` — os modelos de e-mail (21 out 2026)
 * =========================================================================
 * Decisão do cliente: **o Marketing escreve, toda a equipa usa.** O texto
 * aprovado para responder a uma lead, a um proprietário ou a um comprador
 * escreve-se aqui uma vez, e aparece no compositor de e-mail de quem responde.
 *
 * Entra no menu entre as Campanhas e as Métricas, e a ordem tem razão: as
 * Atualizações e as Campanhas são o que se diz **a um público**; os Modelos
 * são o que se diz **a uma pessoa**; as Métricas medem o que saiu. Descer o
 * menu é ir do mais amplo ao mais medido.
 *
 * Sem estado no URL, como as outras três rotas da área: um modelo em
 * preparação não se passa a um colega por link.
 *
 * **Quem escreve é o Marketing e o Admin** — é a verificação que a `actions.ts`
 * faz e que `template_save` repete do lado da base de dados. O Suporte lê, e
 * é para ele que isto existe; a página respeita-o com `canWrite`, que esconde
 * os botões em vez de os deixar falhar.
 */

export const dynamic = "force-dynamic";

export default async function MarketingTemplatesPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [templates, shell, auth] = await Promise.all([
    listTemplates(supabase),
    getMarketingShellData(supabase, t("sidebar.groups.marketing"), t("sidebar.groups.admin")),
    supabase.auth.getUser(),
  ]);

  const userId = auth.data.user?.id ?? null;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    : { data: null };

  const canWrite = profile?.role === "marketing" || profile?.role === "admin";

  return (
    <InternalChrome
      role={shell.role}
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="templates"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <TemplateManager
        templates={templates}
        canWrite={canWrite}
        locale={shell.locale}
        onSave={saveTemplateAction}
        onDelete={deleteTemplateAction}
      />
    </InternalChrome>
  );
}
