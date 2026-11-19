import { SkeletonCard, SkeletonColumns, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonColumns min={320}>
        <SkeletonCard lines={5} title={false} />
        <SkeletonCard lines={4} height={180} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
