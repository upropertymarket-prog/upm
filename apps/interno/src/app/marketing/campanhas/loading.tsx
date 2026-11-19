import { SkeletonCard, SkeletonColumns, SkeletonForm, SkeletonHeader } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider actions={1} />
      <SkeletonColumns basis={["auto", "340px"]}>
        <SkeletonCard lines={3} height={360} />
        <SkeletonForm fields={3} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
