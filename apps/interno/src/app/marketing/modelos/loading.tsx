import { SkeletonCards, SkeletonHeader, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonTabs count={7} />
      <SkeletonCards count={3} min={320} lines={3} />
    </ShellLoading>
  );
}
