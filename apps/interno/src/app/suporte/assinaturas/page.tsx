import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { listMailboxOptions } from "@upm/db/mail";
import { getCompanySignature } from "@upm/db/signatures";

import { InternalChrome } from "../../../components/InternalChrome";
import { getSupportShellData } from "../../../lib/support-shell";
import { setLocalePreference } from "../../actions/preferences";
import { inspectSignatureAction, saveSignatureAction } from "./actions";
import { SignatureManager } from "./SignatureManager";
import "./signatures.css";

/**
 * `/suporte/assinaturas` — o editor de assinaturas (P10-06 · 04 §2.6)
 * =========================================================================
 * A terceira rota da área `/suporte`. A tabela `email_signatures` e a função
 * `mailbox_signature()` já existiam — nasceram com o composer em P10-05,
 * porque sem elas o composer teria de inventar uma assinatura ou não ter
 * nenhuma. O que faltava era **o ecrã**, e é este.
 *
 * **Uma assinatura para toda a empresa** (29 out 2026): o ecrã edita a linha
 * única de `email_signatures`. As caixas só servem à pré-visualização — para
 * ver as variáveis resolvidas com os dados de uma pessoa concreta.
 */

export const dynamic = "force-dynamic";

export default async function SupportSignaturesPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [signature, mailboxes, shell] = await Promise.all([
    getCompanySignature(supabase),
    listMailboxOptions(supabase),
    getSupportShellData(supabase, t("sidebar.groups.support")),
  ]);

  return (
    <InternalChrome
      role="support"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="signatures"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <SignatureManager
        signature={signature}
        mailboxes={mailboxes}
        onSave={saveSignatureAction}
        onInspect={inspectSignatureAction}
      />
    </InternalChrome>
  );
}
