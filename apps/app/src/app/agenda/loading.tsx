import { SkeletonCards, SkeletonHeader, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonTabs count={4} />
      <SkeletonCards count={6} min={280} lines={3} />
    </ShellLoading>
  );
}
