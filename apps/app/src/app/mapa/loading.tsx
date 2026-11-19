import { Skeleton, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading contentWidth="full">
      <SkeletonHeader divider />
      <Skeleton height="min(70vh, 720px)" radius="var(--r-2xl)" />
    </ShellLoading>
  );
}
