import { Skeleton, SkeletonFilters, SkeletonHeader, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader actions={1} />
      <div style={{ display: "grid", gap: "var(--sp-3)", maxWidth: "72ch" }}>
        <Skeleton width="96%" height={12} />
        <Skeleton width="92%" height={12} />
        <Skeleton width="60%" height={12} />
        <Skeleton width="94%" height={12} />
        <Skeleton width="70%" height={12} />
      </div>
      <SkeletonFilters fields={6} />
      <SkeletonTable rows={6} columns={8} pagination />
    </ShellLoading>
  );
}
