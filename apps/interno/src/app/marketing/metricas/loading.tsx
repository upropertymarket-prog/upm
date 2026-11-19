import { SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={2} />
      <SkeletonTable rows={4} columns={8} card={false} />
    </ShellLoading>
  );
}
