import { SharedFileView } from "../../../components/cloud/SharedFileView";
import { openSharedLink } from "../../actions/cloud";

export const dynamic = "force-dynamic";

/**
 * Ligação de partilha — `/partilha/[token]` (P6-02 · 07 §13.3 · §19.11)
 * =========================================================================
 * A única rota da app que se abre sem sessão. Existe porque uma partilha por
 * ligação serve exatamente para chegar a quem não tem conta — o notário, o
 * banco, o familiar que vai ler o contrato.
 *
 * Nada aqui decide se o acesso é legítimo: quem decide é
 * `resolve_file_share`, que valida token, expiração, código de acesso e o
 * limite de tentativas de 07 §19.8. Esta página só mostra o que a função
 * devolveu — e o acesso fica registado antes de a URL assinada ser emitida.
 */
export default async function SharedFilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await openSharedLink(token);

  return <SharedFileView token={token} initial={result} onSubmitCode={openSharedLink} />;
}
