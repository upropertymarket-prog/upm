import { SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../components/loading";

/**
 * A raiz só reencaminha para a área de cada papel; este esqueleto é o que se
 * vê durante esse salto, e a rede de segurança de qualquer rota nova que
 * ainda não tenha o seu `loading.tsx`.
 */
export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonTable rows={8} columns={5} />
    </ShellLoading>
  );
}
