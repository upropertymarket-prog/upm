import { SkeletonCard, SkeletonColumns, SkeletonForm, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonColumns basis={["40%", "auto"]}>
        <SkeletonCard lines={4} />
        <SkeletonForm fields={3} area />
      </SkeletonColumns>
    </ShellLoading>
  );
}
