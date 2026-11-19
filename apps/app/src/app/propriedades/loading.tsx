import { SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonTable rows={8} columns={6} card={false} />
    </ShellLoading>
  );
}
