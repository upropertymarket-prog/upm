import { SkeletonFilters, SkeletonHeader, SkeletonStats, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonStats count={4} min={190} />
      <SkeletonFilters fields={2} button={false} card={false} />
      <SkeletonTable rows={8} columns={6} card={false} />
    </ShellLoading>
  );
}
