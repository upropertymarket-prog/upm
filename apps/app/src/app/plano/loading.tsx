import { SkeletonCard, SkeletonCards, SkeletonHeader, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <div className="upm-split">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
      <SkeletonTabs count={2} />
      <SkeletonCards count={3} min={250} lines={6} />
    </ShellLoading>
  );
}
