import { LegalDocumentPage } from "../../components/legal/LegalDocumentPage";

import { buildMetadata } from "@/lib/seo";
import { seo } from "./seo";

/** Metadados a partir do `seo.ts` desta rota (P2-06). */
export function generateMetadata() {
  return buildMetadata(seo, "/termos");
}

export const dynamic = "force-dynamic";

/**
 * Termos e Condições — `/termos` (Fase 9, P9-02)
 * =========================================================================
 * É a página que o link da caixa de aceitação abre, no registo e na
 * contratação. A moldura vive em `LegalDocumentPage`, partilhada com
 * `/privacidade` e `/cookies`.
 *
 * **Não é a página legal definitiva.** A revisão jurídica das quatro páginas
 * (Termos, Privacidade, Cookies, Proteção de Dados) continua a ser P11-07.
 */
export default function TermsPage() {
  return <LegalDocumentPage kind="terms" fallbackTitleKey="termsTitle" />;
}
