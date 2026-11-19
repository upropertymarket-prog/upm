import {
  Skeleton,
  SkeletonCard,
  SkeletonCards,
  SkeletonColumns,
  SkeletonHeader,
  SkeletonStats,
} from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonStats count={4} />
      <Skeleton width={160} height={20} radius="var(--r-md)" />
      <SkeletonCards count={4} min={220} lines={2} />
      <SkeletonColumns basis={["auto", "34%"]}>
        <SkeletonCard lines={1} height={240} />
        <SkeletonCard lines={4} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
