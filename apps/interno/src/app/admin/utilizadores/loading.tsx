import { SkeletonFilters, SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonFilters fields={4} />
      <SkeletonTable rows={8} columns={5} pagination />
    </ShellLoading>
  );
}
