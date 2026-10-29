import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Documentos legais e aceitação registada (Fase 9, P9-02)
 * =========================================================================
 * Duas regras que não se negoceiam, e que a base de dados impõe:
 *
 * 1. **Nunca um booleano.** Uma aceitação guarda a versão, o hash do corpo, a
 *    data e o IP. `terms_accepted = true` não permite responder à única
 *    pergunta que interessa num litígio — "que texto é que esta pessoa viu?".
 * 2. **O hash é escrito pelo Postgres**, por gatilho, a partir do corpo. Um
 *    hash que a aplicação pudesse escolher não prova nada, e por isso este
 *    ficheiro não o calcula: só o compara.
 */

export const LEGAL_DOCUMENT_KINDS = ["terms", "privacy", "cookies", "data_protection"] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

export const ACCEPTANCE_CONTEXTS = ["registration", "subscription", "reacceptance"] as const;
export type AcceptanceContext = (typeof ACCEPTANCE_CONTEXTS)[number];

/**
 * `draft_pending_legal_review` é o estado da primeira versão dos Termos
 * (P9-02): está publicada, porque sem documento publicado não há registo
 * possível, e **não** foi revista por advogado. A interface tem de dizer isso
 * em cima do texto e em cima da caixa de aceitação — não é decorativo.
 */
export const LEGAL_REVIEW_STATES = ["draft_pending_legal_review", "legally_reviewed"] as const;
export type LegalReviewState = (typeof LEGAL_REVIEW_STATES)[number];

export type LegalDocument = {
  id: string;
  kind: LegalDocumentKind;
  version: string;
  locale: string;
  title: string;
  bodyMd: string;
  contentHash: string;
  reviewState: LegalReviewState;
  effectiveFrom: string | null;
};

export function isPendingLegalReview(document: Pick<LegalDocument, "reviewState">): boolean {
  return document.reviewState === "draft_pending_legal_review";
}

/** A forma em que `current_legal_document()` devolve a linha. */
type AnySupabaseClient = SupabaseClient<Database>;

/** Derivada dos tipos gerados desde que D52 foi paga (7 out 2026). */
type LegalDocumentRow =
  Database["public"]["Functions"]["current_legal_document"]["Returns"][number];

export function toLegalDocument(row: LegalDocumentRow): LegalDocument {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    locale: row.locale,
    title: row.title,
    bodyMd: row.body_md,
    contentHash: row.content_hash,
    reviewState: row.review_state,
    effectiveFrom: row.effective_from,
  };
}

/**
 * O que o cliente envia ao aceitar. O `contentHash` vem do documento que lhe
 * foi mostrado e serve de prova de concordância: se o texto mudou entre o
 * ecrã abrir e o botão ser premido, a aceitação é recusada em vez de registar
 * uma versão que ninguém leu.
 */
export const termsAcceptanceSchema = z.object({
  documentId: z.string().uuid(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/, "Hash inválido"),
  context: z.enum(ACCEPTANCE_CONTEXTS),
});
export type TermsAcceptanceInput = z.infer<typeof termsAcceptanceSchema>;

/** A caixa de aceitação é obrigatória e não vem pré-marcada (P9-02, P9-09). */
export const acceptedCheckboxSchema = z.literal("on", {
  // `error` e não `errorMap`: na v4 o `errorMap` é **ignorado em silêncio** e a
  // mensagem cai para o `Invalid input: expected "on"` em inglês. Não dá erro
  // de tipo — só deixa de se ver (28 out 2026).
  error: () => "Tem de aceitar os Termos e Condições para continuar.",
});

/**
 * A versão publicada de um documento legal, no idioma pedido. `null` quando não
 * existe nenhuma — e nesse caso quem chama diz isso ao utilizador em vez de
 * deixar seguir sem contrato.
 *
 * Vive aqui, e não em cada app, para o registo (`www`), a página `/termos` e o
 * ecrã `/plano` lerem o MESMO documento pela mesma via.
 */
export async function currentLegalDocument(
  client: AnySupabaseClient,
  kind: LegalDocumentKind = "terms",
  locale = "pt",
): Promise<LegalDocument | null> {
  // `returns table` — o cliente devolve sempre um array; zero linhas significa
  // "não há versão publicada", que não é erro.
  const { data } = await client.rpc("current_legal_document", {
    p_kind: kind,
    p_locale: locale,
  });
  const row = data?.[0];
  return row ? toLegalDocument(row) : null;
}

export type TermsAcceptanceStatus = {
  documentId: string | null;
  version: string | null;
  contentHash: string | null;
  reviewState: LegalReviewState | null;
  acceptedAt: string | null;
  acceptedVersion: string | null;
  needsAcceptance: boolean;
};
