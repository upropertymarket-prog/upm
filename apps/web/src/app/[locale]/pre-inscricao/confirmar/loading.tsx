import { SkeletonForm } from "@upm/ui";

import { SectionHeadingLoading, SiteLoading } from "@/components/SiteLoading";

export default function Loading() {
  return (
    <SiteLoading>
      <SectionHeadingLoading />
      <SkeletonForm fields={3} columns={2} title={false} />
    </SiteLoading>
  );
}
