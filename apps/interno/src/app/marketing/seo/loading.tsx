import { SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonTable rows={8} columns={4} card={false} />
    </ShellLoading>
  );
}
