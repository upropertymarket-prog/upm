import { SkeletonCard, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </ShellLoading>
  );
}
