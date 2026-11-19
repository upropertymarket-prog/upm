import { Skeleton, SkeletonCard, SkeletonList } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <Skeleton width={200} height={22} radius="var(--r-md)" />
      <SkeletonCard lines={0} />
      <SkeletonList rows={5} avatar={false} />
    </ShellLoading>
  );
}
