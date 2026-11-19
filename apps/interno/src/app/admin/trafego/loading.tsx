import { Skeleton, SkeletonCard, SkeletonHeader, SkeletonTabs } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <Skeleton height={46} radius="var(--r-xl)" />
      <div className="upm-card upm-card--pad">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-9)" }}>
          <SkeletonTabs count={3} />
          <SkeletonTabs count={3} />
        </div>
      </div>
      <SkeletonCard lines={0} height={240} title={false} />
    </ShellLoading>
  );
}
