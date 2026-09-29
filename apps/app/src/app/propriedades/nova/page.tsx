import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { AppChrome } from "../../../components/AppChrome";
import { PropertyFormWizard } from "../../../components/properties/PropertyFormWizard";
import type { PropertyFormActions } from "../../../components/properties/PropertyFormActions";
import { setLocalePreference } from "../../actions/preferences";
import {
  createDraftProperty,
  deletePropertyMedia,
  publishProperty,
  reorderPropertyMedia,
  saveCharacteristicsStep,
  saveIdentificationStep,
  saveLocationStep,
  savePriceStep,
  setCoverMedia,
  uploadPropertyDocument,
  uploadPropertyMedia,
} from "../../actions/properties";

/**
 * `/propriedades/nova` — passo P4-02 do wizard de imóveis.
 * =========================================================================
 * O middleware já protege `/propriedades` como owner-only; esta página
 * confirma outra vez do lado do servidor (defesa em profundidade, mesmo
 * padrão do resto do projeto).
 */
export default async function NovaPropriedadePage() {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "owner") redirect("/");

  const formActions: PropertyFormActions = {
    createDraft: createDraftProperty,
    saveIdentification: saveIdentificationStep,
    saveCharacteristics: saveCharacteristicsStep,
    saveLocation: saveLocationStep,
    savePrice: savePriceStep,
    uploadMedia: uploadPropertyMedia,
    reorderMedia: reorderPropertyMedia,
    setCoverMedia,
    deleteMedia: deletePropertyMedia,
    uploadDocument: uploadPropertyDocument,
    publish: publishProperty,
  };

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || "Proprietário"}
      userMeta="Proprietário"
      activeId="myProperties"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <PropertyFormWizard actions={formActions} />
    </AppChrome>
  );
}
