import { DirectoryPage } from "./DirectoryPage";

export const dynamic = "force-dynamic";

/** Clientes da app — compradores e proprietários. A equipa está em `/admin/equipa`. */
export default function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DirectoryPage searchParams={searchParams} audience="clients" />;
}
