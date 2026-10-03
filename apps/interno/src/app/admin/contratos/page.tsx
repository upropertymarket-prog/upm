import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { TemplateManager } from "./TemplateManager";
import { createTemplate, publishTemplate, saveTemplate, startTemplateVersion } from "./actions";
import { getAdminShellData } from "../../../lib/admin-shell";

export default async function ContractTemplatesPage() {
  const supabase = createClient(await cookies());
  const [shell, templates] = await Promise.all([
    getAdminShellData(supabase),
    supabase
      .from("contract_templates")
      .select("id, family_id, name, kind, version, status, body, variables, updated_at")
      .order("updated_at", { ascending: false }),
  ]);
  return (
    <InternalChrome
      role="admin"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="contractTemplates"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
    >
      <TemplateManager
        templates={(templates.data ?? []) as never}
        actions={{ createTemplate, saveTemplate, startTemplateVersion, publishTemplate }}
      />
    </InternalChrome>
  );
}
