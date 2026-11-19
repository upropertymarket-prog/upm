import { SkeletonCard, SkeletonForm, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonForm fields={3} />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={2} />
    </ShellLoading>
  );
}
