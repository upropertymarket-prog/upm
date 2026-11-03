import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, obterUtilizador } from "@upm/db/server";

import { AppChrome } from "../../../../components/AppChrome";
import { PropertyFormWizard } from "../../../../components/properties/PropertyFormWizard";
import type { PropertyFormActions } from "../../../../components/properties/PropertyFormActions";
import { setLocalePreference } from "../../../actions/preferences";
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
} from "../../../actions/properties";

/**
 * `/propriedades/[id]/editar` — mesmo wizard P4-02, com `initialValue`
 * carregado do imóvel existente. Confirma sessão + role + posse do lado do
 * servidor antes de renderizar (defesa em profundidade).
 */
export default async function EditarPropriedadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), obterUtilizador(supabase)]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "owner") redirect("/");

  const { data: property } = await supabase
    .from("properties")
    .select(
      "id, owner_id, ref, title, description, deal, status, property_type, typology, condition, gross_area, net_area, bedrooms, bathrooms, floor, year_built, energy_cert, price_cents, rent_cents, condo_fee_cents, imi_cents, accepts_offers, amenities, address_line, postal_code, city, parish, district, location_approx, approx_radius_m, show_exact, views_count, rejection_reason, published_at, submitted_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!property) redirect("/propriedades");

  const { data: media } = await supabase
    .from("property_media")
    .select("id, path, kind, position, is_cover")
    .eq("property_id", id)
    .order("position", { ascending: true });

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
      <PropertyFormWizard
        actions={formActions}
        initialValue={property}
        initialMedia={media ?? []}
      />
    </AppChrome>
  );
}
