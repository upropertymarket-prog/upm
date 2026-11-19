import { SkeletonCard, SkeletonColumns, SkeletonForm, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonColumns min={320}>
        <SkeletonForm fields={5} />
        <SkeletonCard lines={4} height={180} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
