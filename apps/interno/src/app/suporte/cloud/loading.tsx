import { SkeletonCard, SkeletonColumns, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={2} />
      <SkeletonColumns basis={["248px", "auto"]}>
        <SkeletonCard lines={3} title={false} height={36} />
        <SkeletonCard lines={3} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
