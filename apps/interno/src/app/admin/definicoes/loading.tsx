import { SkeletonCard, SkeletonForm, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader />
      <SkeletonCard lines={2} height={72} />
      <SkeletonForm fields={4} columns={2} />
    </ShellLoading>
  );
}
