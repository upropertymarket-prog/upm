import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@upm/db";

import type { PropertyCardData } from "../components/market/PropertyCard";

/** O mesmo alias dos outros módulos de `lib/` (billing, cloud, interaction). */
type Client = SupabaseClient<Database>;

/** O subconjunto de `properties_public` que um cartão do Market precisa. */
export type PropertyCardRow = {
  id: string | null;
  title: string | null;
  deal: "sale" | "rent" | null;
  typology: string | null;
  city: string | null;
  price_cents: number | null;
  rent_cents: number | null;
};

/**
 * Resolve a capa assinada de cada imóvel e devolve cartões prontos (P4-04a).
 * =========================================================================
 * Vivia dentro de `market/page.tsx`. Saiu para aqui quando o detalhe passou a
 * mostrar "Anúncios semelhantes" e "Mais anúncios de…": três sítios a assinar
 * capas da mesma maneira é onde as regras começam a divergir em silêncio.
 *
 * A URL assinada expira (1 h), por isso gera-se sempre do lado do servidor e
 * nunca se guarda.
 */
export async function resolvePropertyCards(
  supabase: Client,
  rows: PropertyCardRow[],
): Promise<PropertyCardData[]> {
  return Promise.all(
    rows.map(async (property) => {
      let coverUrl: string | null = null;
      if (property.id) {
        const { data: media } = await supabase
          .from("property_media")
          .select("path")
          .eq("property_id", property.id)
          .order("is_cover", { ascending: false })
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (media) {
          const { data: signed } = await supabase.storage
            .from("property-media")
            .createSignedUrl(media.path, 3600);
          coverUrl = signed?.signedUrl ?? null;
        }
      }
      return {
        id: property.id ?? "",
        title: property.title,
        deal: property.deal,
        typology: property.typology,
        city: property.city,
        price_cents: property.price_cents,
        rent_cents: property.rent_cents,
        coverUrl,
      };
    }),
  );
}
