import type { EmailSignatureRow } from "../../../packages/db/src/signatures";

/**
 * Assinaturas — os dados das storyboards do editor (P10-06)
 * =========================================================================
 * **Uma assinatura para toda a empresa** (29 out 2026): a tabela tem no
 * máximo uma linha, e já não há caixas associadas nem lista.
 *
 * - **O HTML é o do modelo de partida** (`SIGNATURE_TEMPLATE`, copiado e não
 *   importado — ver a nota em `Signatures.tsx`).
 * - **Datas fixas.** Duas montagens da mesma storyboard têm de dar o mesmo pixel.
 */

const MODELO = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5;">
  <tr>
    <td style="padding-right: 14px; vertical-align: top;">
      <div style="font-weight: 800; font-size: 15px; color: #EA580C; white-space: nowrap;">UProperty Market</div>
    </td>
    <td style="padding-left: 14px; border-left: 2px solid #CBD5E1; vertical-align: top;">
      <div style="font-weight: 700; color: #0F172A;">{{nome}}</div>
      <div style="color: #64748B;">{{cargo}} · {{departamento}}</div>
      <div style="padding-top: 6px;">
        <a href="mailto:{{email}}" style="color: #EA580C; text-decoration: none;">{{email}}</a>
      </div>
      <div style="color: #64748B;">{{telefone}}</div>
      <div style="padding-top: 6px; color: #64748B; font-size: 12px;">Imóveis sem comissões.</div>
    </td>
  </tr>
</table>`;

export const SIGNATURE: EmailSignatureRow = {
  id: "5a5a5a5a-1111-4111-8111-5a5a5a5a5a5a",
  name: "Assinatura da empresa",
  html: MODELO,
  created_at: "2026-10-14T10:00:00.000Z",
  updated_at: "2026-10-20T09:30:00.000Z",
};

/**
 * Os dados do dono da caixa, como `resolve_signature_variables()` os traria.
 * Na app é a base de dados que resolve (05 §1.8); aqui é só para a coluna da
 * pré-visualização mostrar uma pessoa e não as chavetas.
 */
export const VARIAVEIS_RESOLVIDAS: Record<string, string> = {
  nome: "Helena Matos",
  cargo: "Apoio ao cliente",
  departamento: "Suporte",
  email: "suporte@upropertymarket.pt",
  telefone: "+351 210 000 000",
  iniciais: "HM",
};

/** HTML colado com o que o sanitizador tira — o estado dos avisos. */
export const HTML_COM_AVISOS = MODELO.replace(
  '<div style="font-weight: 700; color: #0F172A;">{{nome}}</div>',
  '<div style="font-weight: 700; color: #0F172A;">{{nome}}</div><img src="https://example.com/x.png" onerror="alert(1)"><script>track()</script>',
).replace("{{telefone}}", "{{telemovel}}");
