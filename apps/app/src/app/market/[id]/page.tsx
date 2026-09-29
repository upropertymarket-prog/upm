import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { Card, CardBody, StatusTag } from "@upm/ui";

import { AppChrome } from "../../../components/AppChrome";
import { SaveButton } from "../../../components/market/SaveButton";
import { PropertyLocationMap } from "../../../components/map/PropertyLocationMap";
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

  let initialSaved = false;
  if (role === "buyer") {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Link
          href="/market"
          className="upm-btn upm-btn--secondary upm-btn--sm"
          style={{ alignSelf: "flex-start", textDecoration: "none" }}
        >
          ← Voltar ao Market
        </Link>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
            gap: 28,
            alignItems: "start",
          }}
        >
          <main style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 3fr) minmax(110px, 1fr)",
                gap: 8,
                height: 360,
              }}
            >
              {validPhotos[0] ? (
                <img
                  src={validPhotos[0]}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 16,
                    background: "var(--surface-muted, #eee)",
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
                {validPhotos.slice(1, 4).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    style={{
                      width: "100%",
                      flex: 1,
                      minHeight: 0,
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Ref. {property.ref}</span>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{property.title}</h1>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                ⌖{" "}
                {[property.typology, property.city, property.district].filter(Boolean).join(" · ")}
              </p>
            </div>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                margin: 0,
              }}
            >
              <Detail label="Tipologia" value={property.typology} />
              <Detail
                label="Área bruta"
                value={property.gross_area ? `${property.gross_area} m²` : null}
              />
              <Detail label="Casas de banho" value={property.bathrooms?.toString() ?? null} />
              <Detail label="Piso" value={property.floor} />
              <Detail label="Ano de construção" value={property.year_built?.toString() ?? null} />
              <Detail label="Certificado energético" value={property.energy_cert} />
            </dl>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Descrição do proprietário</h2>
              <p style={{ margin: 0, lineHeight: 1.75, color: "var(--muted)" }}>
                {property.description}
              </p>
            </div>
            {location ? (
              <Card>
                <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>Localização aproximada</strong>
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                      morada exata após contacto
                    </span>
                  </div>
                  <PropertyLocationMap
                    lon={location.lon}
                    lat={location.lat}
                    isExact={location.is_exact}
                    radiusM={location.radius_m}
                  />
                </CardBody>
              </Card>
            ) : null}
          </main>
          <aside
            style={{
              position: "sticky",
              top: 88,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <Card>
              <CardBody style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {property.deal ? (
                  <StatusTag tone={property.deal === "sale" ? "dealSale" : "dealRent"}>
                    {property.deal === "sale" ? "Venda" : "Arrendamento"}
                  </StatusTag>
                ) : null}
                <strong style={{ fontSize: 30 }}>{price}</strong>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <strong>{ownerProfile?.full_name || "Proprietário"}</strong>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>Responde em ~2 h</div>
                </div>
                {role === "buyer" ? (
                  <SaveButton
                    propertyId={id}
                    initialSaved={initialSaved}
                    action={toggleSavedProperty}
                  />
                ) : null}
                <a
                  href="/mensagens"
                  className="upm-btn upm-btn--primary upm-btn--md upm-btn--full"
                  style={{ textDecoration: "none", textAlign: "center" }}
                >
                  Contactar
                </a>
                <a
                  href="/visitas"
                  className="upm-btn upm-btn--secondary upm-btn--md upm-btn--full"
                  style={{ textDecoration: "none", textAlign: "center" }}
                >
                  Marcar visita
                </a>
              </CardBody>
            </Card>
          </aside>
        </div>
      </div>
    </AppChrome>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <dt style={{ color: "var(--muted)", fontSize: 12 }}>{label}</dt>
      <dd style={{ margin: "4px 0 0", fontWeight: 700 }}>{value}</dd>
    </div>
  );
}
