import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { listMailboxOptions } from "@upm/db/mail";
import { listSignatures } from "@upm/db/signatures";

import { InternalChrome } from "../../../components/InternalChrome";
import { getSupportShellData } from "../../../lib/support-shell";
import { setLocalePreference } from "../../actions/preferences";
import { deleteSignatureAction, inspectSignatureAction, saveSignatureAction } from "./actions";
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
 * Sem estado no URL, ao contrário dos tickets e da caixa: uma assinatura não é
 * uma coisa que se passe a um colega por link, e a lista tem meia dúzia de
 * linhas. Quando houver razão para partilhar uma, há dado para a pôr no URL.
 */

export const dynamic = "force-dynamic";

export default async function SupportSignaturesPage() {
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [signatures, mailboxes, shell] = await Promise.all([
    listSignatures(supabase),
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
        signatures={signatures}
        mailboxes={mailboxes}
        onSave={saveSignatureAction}
        onDelete={deleteSignatureAction}
        onInspect={inspectSignatureAction}
      />
    </InternalChrome>
  );
}
