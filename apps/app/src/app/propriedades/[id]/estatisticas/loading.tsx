import { Skeleton, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <Skeleton width="min(100%, 320px)" height={22} radius="var(--r-md)" />
      <SkeletonTable rows={8} columns={4} card={false} />
    </ShellLoading>
  );
}
