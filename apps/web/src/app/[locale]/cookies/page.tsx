import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, "/cookies");
}

export const dynamic = "force-dynamic";

/**
 * Política de Cookies — `/cookies` (P11-07, antecipada a 6 out 2026)
 * =========================================================================
 * A minuta descreve o que a plataforma **hoje** usa, e não uma lista genérica:
 * sessão do Supabase, preferências de idioma e tema, e analítica sem cookies
 * (07 §19 — a decisão de não usar cookies de analítica já estava tomada, e o
 * texto limita-se a dizê-lo). Por isso não há secção de consentimento: não há
 * cookies que o exijam. Se isso mudar, muda primeiro o produto e só depois o
 * documento.
 */
export default function CookiesPage() {
  return <LegalDocumentPage kind="cookies" fallbackTitleKey="cookiesTitle" />;
}
