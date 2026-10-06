import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { AppChrome } from "../../../components/AppChrome";
import { ContactActions } from "../../../components/market/ContactActions";
import { OwnerListingBar } from "../../../components/market/OwnerListingBar";
import { PropertyDetail } from "../../../components/market/PropertyDetail";
import { SaveButton } from "../../../components/market/SaveButton";
import { startConversation } from "../../actions/conversations";
import { requestVisit } from "../../actions/visits";
import { toggleSavedProperty } from "../../actions/saved-properties";
import { setLocalePreference } from "../../actions/preferences";
import { formatCents } from "../../../lib/money";

export const dynamic = "force-dynamic";

/** Detalhe de imóvel: galeria, informação, localização e ações numa só página. */
export default async function MarketPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);
  const user = authData.user;
  if (!user) redirect("/");

  const [{ data: profile }, { data: property, error }] = await Promise.all([
    supabase.from("profiles").select("role, full_name").eq("id", user.id).single(),
    supabase.from("properties_public").select("*").eq("id", id).single(),
  ]);
  if (error || !property) notFound();

  const locationRpc = supabase.rpc as unknown as (
    fn: "property_location_point",
    args: { p_property_id: string },
  ) => Promise<{
    data: { lon: number; lat: number; is_exact: boolean; radius_m: number }[] | null;
    error: unknown;
  }>;
  const [{ data: locationRows }, { data: ownerProfile }] = await Promise.all([
    locationRpc("property_location_point", { p_property_id: id }),
    property.owner_id
      ? supabase.from("profiles").select("full_name").eq("id", property.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const location = locationRows?.[0] ?? null;
  const role = profile?.role === "owner" ? "owner" : "buyer";

  const { data: media } = await supabase
    .from("property_media")
    .select("path, is_cover, position")
    .eq("property_id", id)
    .order("is_cover", { ascending: false })
    .order("position", { ascending: true });
  const photos = await Promise.all(
    (media ?? []).map(async (item) => {
      const { data: signed } = await supabase.storage
        .from("property-media")
        .createSignedUrl(item.path, 3600);
      return signed?.signedUrl ?? null;
    }),
  );
  const validPhotos = photos.filter((url): url is string => Boolean(url));

  // O que decide o que esta página mostra é **de quem é o imóvel**, não o papel
  // da conta: uma proprietária a ver o anúncio de outra pessoa é, nesse
  // momento, uma interessada como qualquer outra (04 §2.3).
  const isOwnProperty = property.owner_id === user.id;

  let initialSaved = false;
  if (!isOwnProperty) {
    const { data: saved } = await supabase
      .from("saved_properties")
      .select("id")
      .eq("user_id", user.id)
      .eq("property_id", id)
      .maybeSingle();
    initialSaved = Boolean(saved);
  }
  const price = formatCents(property.price_cents ?? property.rent_cents);

  return (
    <AppChrome
      role={role}
      userName={profile?.full_name || "Utilizador"}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="market"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <PropertyDetail
        property={{
          ref: property.ref,
          title: property.title,
          typology: property.typology,
          city: property.city,
          district: property.district,
          description: property.description,
          grossArea: property.gross_area,
          bathrooms: property.bathrooms,
          floor: property.floor,
          yearBuilt: property.year_built,
          energyCert: property.energy_cert,
          deal: property.deal,
        }}
        photos={validPhotos}
        location={
          location
            ? {
                lon: location.lon,
                lat: location.lat,
                isExact: location.is_exact,
                radiusM: location.radius_m,
              }
            : null
        }
        price={price}
        ownerName={ownerProfile?.full_name || "Proprietário"}
        management={
          isOwnProperty ? (
            <OwnerListingBar
              // A view só devolve `active` e `featured`; o `null` do tipo
              // gerado não acontece nesta rota.
              status={property.status ?? "active"}
              viewsCount={property.views_count}
              editHref={`/propriedades/${id}/editar`}
              statsHref={`/propriedades/${id}/estatisticas`}
            />
          ) : null
        }
        actions={
          isOwnProperty ? null : (
            <>
              <SaveButton
                propertyId={id}
                initialSaved={initialSaved}
                action={toggleSavedProperty}
              />
              {/* D20 — deixaram de estar desativados: P5-01 e P5-02 deram-lhes
                  destino. No próprio anúncio nem sequer entram na árvore: a
                  decisão passou do `disabled` do componente para quem o usa,
                  que é onde se sabe de quem é o imóvel. */}
              <ContactActions
                propertyId={id}
                propertyTitle={property.title ?? "Imóvel"}
                onContact={startConversation}
                onRequestVisit={requestVisit}
              />
            </>
          )
        }
      />
    </AppChrome>
  );
}
