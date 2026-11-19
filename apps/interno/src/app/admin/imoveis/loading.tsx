import { SkeletonHeader, SkeletonTable, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonTabs count={4} />
      <SkeletonTable rows={10} columns={6} pagination />
    </ShellLoading>
  );
}
