import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, "/privacidade");
}

export const dynamic = "force-dynamic";

/**
 * Política de Privacidade — `/privacidade` (P11-07, antecipada a 6 out 2026)
 * =========================================================================
 * Antecipada a pedido do cliente, para o rodapé de autenticação deixar de ter
 * três documentos prometidos e nenhum endereço. O texto é **minuta**, como os
 * Termos: entra com `review_state = 'draft_pending_legal_review'` e a página
 * mostra o aviso por cima do corpo.
 *
 * O que falta para fechar P11-07 não é esta página — é a revisão por advogado e
 * os dados da empresa, que continuam marcadores em maiúsculas no texto.
 */
export default function PrivacyPage() {
  return <LegalDocumentPage kind="privacy" fallbackTitleKey="privacyTitle" />;
}
