import { SkeletonCards, SkeletonFilters, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <SkeletonFilters fields={6} card={false} />
      <SkeletonCards count={8} min={240} lines={3} height={160} />
    </ShellLoading>
  );
}
