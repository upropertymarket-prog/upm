import { SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../components/loading";

/** Rede de segurança de qualquer rota nova que ainda não tenha o seu `loading.tsx`. */
export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonTable rows={8} columns={5} card={false} />
    </ShellLoading>
  );
}
