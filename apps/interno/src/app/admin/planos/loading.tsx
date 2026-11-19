import { SkeletonCard, SkeletonColumns, SkeletonHeader, SkeletonStats } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={2} />
      <SkeletonStats count={4} />
      <SkeletonColumns basis={["auto", "36%"]}>
        <SkeletonCard lines={8} />
        <SkeletonCard lines={5} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
