"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { SITE_CACHE_TAGS, invalidarCacheDoSite, listingTag } from "@upm/config/site-cache";
import { createClient } from "@upm/db/server";
import { planLimitMessage } from "@upm/db/billing";
import {
  characteristicsStepSchema,
  identificationStepSchema,
  locationStepSchema,
  priceStepSchema,
  type CharacteristicsStepInput,
  type IdentificationStepInput,
  type LocationStepInput,
  type PriceStepInput,
} from "@upm/db/properties";
import { approxOffset, geocodeAddress, toEwkt } from "@upm/db/geocoding";
import { sniffImageMimeAllowed, type ImageKind } from "@upm/db/image-mime";

/**
 * Server Actions do formulário "Nova propriedade" (P4-02) — 05 §1.2, 08 §7.3.
 * =========================================================================
 * Todas confirmam sessão logo no início e confirmam posse (`eq("owner_id",
 * user.id)`) explicitamente nos updates, em cima da RLS (defesa em
 * profundidade, padrão do projeto). Nenhuma lança exceção para o cliente —
 * falhas voltam sempre como `{ error }`.
 */

/**
 * O que o proprietário muda num anúncio tem de chegar ao site público, que o
 * guarda em cache noutro processo (F2 · D61). Invalidar um rascunho custa
 * um pedido e nada mais; perguntar primeiro se está publicado custava o mesmo.
 */
async function refletirNoSite(propertyId: string): Promise<void> {
  after(() => invalidarCacheDoSite([SITE_CACHE_TAGS.listings, listingTag(propertyId)]));
}

const MEDIA_BUCKET = "property-media";
const DOCUMENTS_BUCKET = "documents";

// `as const` para o tipo chegar ao `sniffImageMimeAllowed` em vez de `string[]`.
const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MEDIA_MAX_BYTES = 15 * 1024 * 1024;

const DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

const DOCUMENT_KINDS = ["certidao", "caderneta", "energetico", "planta", "outro"] as const;

export async function createDraftProperty(): Promise<{ id: string } | { error: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  // `properties.ref` tem `default 'UPM-' || nextval(...)` (P4-01a) — não
  // gerar aqui, a sequência SQL trata disso.
  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      deal: "sale",
      status: "draft",
      typology: "T1",
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Não foi possível criar o rascunho. Tenta novamente." };
  return { id: data.id };
}

export async function saveIdentificationStep(
  propertyId: string,
  data: IdentificationStepInput,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const parsed = identificationStepSchema.safeParse(data);
  if (!parsed.success) return { error: "Dados de identificação inválidos." };

  const { error } = await supabase
    .from("properties")
    .update({
      title: parsed.data.title,
      deal: parsed.data.deal,
      property_type: parsed.data.property_type,
      typology: parsed.data.typology,
      condition: parsed.data.condition,
      description: parsed.data.description,
    })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: "Não foi possível guardar a identificação." };
  await refletirNoSite(propertyId);
  return {};
}

export async function saveCharacteristicsStep(
  propertyId: string,
  data: CharacteristicsStepInput,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const parsed = characteristicsStepSchema.safeParse(data);
  if (!parsed.success) return { error: "Dados de características inválidos." };

  const { error } = await supabase
    .from("properties")
    .update({
      gross_area: parsed.data.gross_area,
      net_area: parsed.data.net_area,
      bedrooms: parsed.data.bedrooms,
      bathrooms: parsed.data.bathrooms,
      floor: parsed.data.floor,
      year_built: parsed.data.year_built,
      energy_cert: parsed.data.energy_cert,
      amenities: parsed.data.amenities,
    })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: "Não foi possível guardar as características." };
  await refletirNoSite(propertyId);
  return {};
}

export async function saveLocationStep(
  propertyId: string,
  data: LocationStepInput,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const parsed = locationStepSchema.safeParse(data);
  if (!parsed.success) return { error: "Morada inválida." };

  const addressFields = {
    address_line: parsed.data.address_line,
    postal_code: parsed.data.postal_code,
    city: parsed.data.city,
    parish: parsed.data.parish,
    district: parsed.data.district,
    show_exact: parsed.data.show_exact,
  };

  const exact = await geocodeAddress(
    `${parsed.data.address_line}, ${parsed.data.postal_code} ${parsed.data.city}, Portugal`,
  );

  if (!exact) {
    const { error } = await supabase
      .from("properties")
      .update(addressFields)
      .eq("id", propertyId)
      .eq("owner_id", user.id);

    if (error) return { error: "Não foi possível guardar a morada." };
    return {
      error:
        "Não foi possível confirmar a morada no mapa — os dados foram guardados, tenta novamente mais tarde.",
    };
  }

  const approx = await approxOffset(propertyId, exact, 400);

  const { error } = await supabase
    .from("properties")
    .update({
      ...addressFields,
      location: toEwkt(exact),
      location_approx: toEwkt(approx),
      approx_radius_m: 400,
    })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: "Não foi possível guardar a morada." };
  await refletirNoSite(propertyId);
  return {};
}

export async function savePriceStep(
  propertyId: string,
  data: PriceStepInput,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const parsed = priceStepSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados de preço inválidos." };
  }

  const { error } = await supabase
    .from("properties")
    .update({
      price_cents: parsed.data.price_cents,
      rent_cents: parsed.data.rent_cents,
      condo_fee_cents: parsed.data.condo_fee_cents,
      imi_cents: parsed.data.imi_cents,
      accepts_offers: parsed.data.accepts_offers,
    })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: "Não foi possível guardar o preço." };
  await refletirNoSite(propertyId);
  return {};
}

async function assertOwnsProperty(
  supabase: ReturnType<typeof createClient>,
  propertyId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", userId)
    .single();
  return Boolean(data);
}

export async function uploadPropertyMedia(
  propertyId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  if (!(await assertOwnsProperty(supabase, propertyId, user.id))) {
    return { error: "Imóvel não encontrado." };
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) return { error: "Nenhum ficheiro enviado." };

  /**
   * O tipo decide-se pelos bytes, não pelo que o browser declara (12 §5.4).
   *
   * Até 31 out 2026 isto lia `file.type` — que num `FormData` é escrito pelo
   * browser a partir da extensão do nome, e por quem publica o pedido à mão é
   * escrito à vontade. Qualquer ficheiro entrava em `property-media` desde que
   * se dissesse `image/jpeg`.
   *
   * E não ficava ali: o `mail-worker` copia a capa de um imóvel para
   * `campaign-assets` ao montar uma campanha, e esse bucket é **público** —
   * um ficheiro arbitrário passava de um formulário de anúncio a um URL aberto
   * na internet, em dois passos que ninguém liga um ao outro.
   *
   * Todos os outros cinco caminhos de upload deste produto já validavam pelos
   * bytes. Este era o que faltava, e é o de maior volume.
   */
  const validos: { file: File; bytes: Uint8Array; kind: ImageKind }[] = [];
  for (const file of files) {
    if (file.size > MEDIA_MAX_BYTES) {
      return { error: `Ficheiro demasiado grande: ${file.name} (máx. 15MB).` };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImageMimeAllowed(bytes, MEDIA_MIME_TYPES);
    if (!kind) {
      return { error: `Tipo de ficheiro não suportado: ${file.name}.` };
    }
    validos.push({ file, bytes, kind });
  }

  const { data: lastPositioned } = await supabase
    .from("property_media")
    .select("position")
    .eq("property_id", propertyId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { count: existingCount } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  let nextPosition = (lastPositioned?.position ?? -1) + 1;
  let hasCover = (existingCount ?? 0) > 0;

  for (const { file, bytes, kind } of validos) {
    const path = `${propertyId}/${crypto.randomUUID()}-${file.name}`;
    // `kind.type` e não `file.type`: o que fica gravado é o que os bytes
    // dizem ser. Um `Content-Type` guardado a partir da declaração seria a
    // mesma mentira, só que persistida.
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, bytes, { contentType: kind.type });
    if (uploadError) return { error: "Não foi possível enviar as fotografias." };

    const isFirstEver = !hasCover;
    const { error: insertError } = await supabase.from("property_media").insert({
      property_id: propertyId,
      path,
      kind: "photo",
      position: nextPosition,
      is_cover: isFirstEver,
    });
    if (insertError) return { error: "Não foi possível guardar as fotografias." };

    nextPosition += 1;
    hasCover = true;
  }

  await refletirNoSite(propertyId);
  return {};
}

export async function reorderPropertyMedia(
  propertyId: string,
  mediaIds: string[],
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  if (!(await assertOwnsProperty(supabase, propertyId, user.id))) {
    return { error: "Imóvel não encontrado." };
  }

  const { data: rows } = await supabase
    .from("property_media")
    .select("id")
    .eq("property_id", propertyId);
  const validIds = new Set((rows ?? []).map((row) => row.id));
  if (!mediaIds.every((id) => validIds.has(id))) {
    return { error: "Fotografia não pertence a este imóvel." };
  }

  for (let index = 0; index < mediaIds.length; index += 1) {
    const { error } = await supabase
      .from("property_media")
      .update({ position: index })
      .eq("id", mediaIds[index]!)
      .eq("property_id", propertyId);
    if (error) return { error: "Não foi possível reordenar as fotografias." };
  }

  await refletirNoSite(propertyId);
  return {};
}

export async function setCoverMedia(
  propertyId: string,
  mediaId: string,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  if (!(await assertOwnsProperty(supabase, propertyId, user.id))) {
    return { error: "Imóvel não encontrado." };
  }

  const { error: clearError } = await supabase
    .from("property_media")
    .update({ is_cover: false })
    .eq("property_id", propertyId);
  if (clearError) return { error: "Não foi possível definir a capa." };

  const { error: setError } = await supabase
    .from("property_media")
    .update({ is_cover: true })
    .eq("id", mediaId)
    .eq("property_id", propertyId);
  if (setError) return { error: "Não foi possível definir a capa." };

  await refletirNoSite(propertyId);
  return {};
}

export async function deletePropertyMedia(
  propertyId: string,
  mediaId: string,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  if (!(await assertOwnsProperty(supabase, propertyId, user.id))) {
    return { error: "Imóvel não encontrado." };
  }

  const { data: media } = await supabase
    .from("property_media")
    .select("path")
    .eq("id", mediaId)
    .eq("property_id", propertyId)
    .single();
  if (!media) return { error: "Fotografia não encontrada." };

  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([media.path]);
  if (storageError) return { error: "Não foi possível remover a fotografia." };

  const { error: deleteError } = await supabase
    .from("property_media")
    .delete()
    .eq("id", mediaId)
    .eq("property_id", propertyId);
  if (deleteError) return { error: "Não foi possível remover a fotografia." };

  await refletirNoSite(propertyId);
  return {};
}

export async function uploadPropertyDocument(
  propertyId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  if (!(await assertOwnsProperty(supabase, propertyId, user.id))) {
    return { error: "Imóvel não encontrado." };
  }

  const file = formData.get("files");
  const kindValue = formData.get("kind");
  if (!(file instanceof File)) return { error: "Nenhum ficheiro enviado." };
  if (
    typeof kindValue !== "string" ||
    !DOCUMENT_KINDS.includes(kindValue as (typeof DOCUMENT_KINDS)[number])
  ) {
    return { error: "Tipo de documento inválido." };
  }

  if (!DOCUMENT_MIME_TYPES.includes(file.type)) {
    return { error: `Tipo de ficheiro não suportado: ${file.name}.` };
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return { error: `Ficheiro demasiado grande: ${file.name} (máx. 20MB).` };
  }

  const path = `${propertyId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: "Não foi possível enviar o documento." };

  const { error: insertError } = await supabase.from("property_documents").insert({
    property_id: propertyId,
    storage_path: path,
    name: file.name,
    mime: file.type,
    size: file.size,
    kind: kindValue,
  });
  if (insertError) return { error: "Não foi possível guardar o documento." };

  return {};
}

export async function publishProperty(propertyId: string): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { data: property } = await supabase
    .from("properties")
    .select("title, deal, property_type, typology, condition, address_line, city")
    .eq("id", propertyId)
    .eq("owner_id", user.id)
    .single();
  if (!property) return { error: "Imóvel não encontrado." };

  const missing: string[] = [];
  if (!property.title.trim()) missing.push("título");
  if (!property.deal) missing.push("tipo de negócio");
  if (!property.property_type.trim()) missing.push("tipo de imóvel");
  if (!property.typology.trim()) missing.push("tipologia");
  if (!property.condition.trim()) missing.push("estado");
  if (!property.address_line?.trim()) missing.push("morada");
  if (!property.city?.trim()) missing.push("cidade");

  const { count: mediaCount } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  if (!mediaCount) missing.push("pelo menos uma fotografia");

  if (missing.length > 0) {
    return { error: `Antes de publicar, completa: ${missing.join(", ")}.` };
  }

  const { error } = await supabase
    .from("properties")
    .update({ status: "pending_review" })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: planLimitMessage(error) ?? "Não foi possível publicar o imóvel." };
  await refletirNoSite(propertyId);
  return {};
}

export async function archiveProperty(propertyId: string): Promise<{ error?: string }> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase
    .from("properties")
    .update({ status: "archived" })
    .eq("id", propertyId)
    .eq("owner_id", user.id);

  if (error) return { error: "Não foi possível arquivar o imóvel." };
  await refletirNoSite(propertyId);
  return {};
}
