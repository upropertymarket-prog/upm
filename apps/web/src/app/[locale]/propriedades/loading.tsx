import { SkeletonCards, SkeletonFilters } from "@upm/ui";

import { SectionHeadingLoading, SiteLoading } from "@/components/SiteLoading";

export default function Loading() {
  return (
    <SiteLoading>
      <SectionHeadingLoading />
      <SkeletonFilters fields={4} />
      <SkeletonCards count={9} min={280} lines={3} height={200} />
    </SiteLoading>
  );
}
