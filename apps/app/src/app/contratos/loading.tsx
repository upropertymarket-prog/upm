import { SkeletonHeader, SkeletonTable, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonTabs count={3} />
      <SkeletonTable rows={8} columns={5} card={false} />
    </ShellLoading>
  );
}
