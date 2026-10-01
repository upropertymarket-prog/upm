import { cookies } from "next/headers";
import { createClient } from "@upm/db/server";
import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { TemplateManager } from "./TemplateManager";
import { createTemplate, publishTemplate, saveTemplate, startTemplateVersion } from "./actions";

export default async function ContractTemplatesPage() {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("contract_templates")
    .select("id, family_id, name, kind, version, status, body, variables, updated_at")
    .order("updated_at", { ascending: false });
  return (
    <InternalChrome
      role="admin"
      userName="Helena Matos"
      userMeta="Administração · IT"
      activeId="contractTemplates"
      locale="pt"
      onLocaleChange={setLocalePreference}
      counters={{ propertyModeration: 4, siteLeads: 12 }}
    >
      <TemplateManager
        templates={(data ?? []) as never}
        actions={{ createTemplate, saveTemplate, startTemplateVersion, publishTemplate }}
      />
    </InternalChrome>
  );
}
