import { SkeletonForm, SkeletonHeader, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonTabs count={5} />
      <SkeletonForm fields={6} columns={2} title={false} />
    </ShellLoading>
  );
}
