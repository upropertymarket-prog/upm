import { SkeletonFilters, SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonFilters fields={3} />
      <SkeletonTable rows={4} columns={4} pagination />
    </ShellLoading>
  );
}
