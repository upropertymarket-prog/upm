import { Skeleton, SkeletonCard, SkeletonColumns, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "var(--sp-5)",
        }}
      >
        <SkeletonTabs count={4} />
        <Skeleton width={224} height="var(--h-sm)" radius="var(--r-lg)" />
      </div>
      <SkeletonColumns min={320}>
        <SkeletonCard lines={6} title={false} />
        <SkeletonCard lines={4} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
