import { DirectoryPage } from "../utilizadores/DirectoryPage";

export const dynamic = "force-dynamic";

/**
 * A equipa interna — admin, suporte e marketing (14 nov 2026). Separada dos
 * clientes da app por decisão do cliente; as ações de equipa (repor a
 * palavra-passe e a 2FA, a saída) vivem aqui.
 */
export default function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DirectoryPage searchParams={searchParams} audience="staff" />;
}
