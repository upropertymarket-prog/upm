import {
  Skeleton,
  SkeletonCard,
  SkeletonCards,
  SkeletonColumns,
  SkeletonHeader,
  SkeletonStats,
} from "@upm/ui";

import { ShellLoading } from "../../components/loading";

/** Um título de secção do Painel ("As suas estatísticas", "Acesso rápido"). */
const Section = () => <Skeleton width={180} height={18} radius="var(--r-md)" />;

export default function Loading() {
  return (
    <ShellLoading>
      <SkeletonHeader divider />
      <Section />
      <SkeletonStats count={4} min={180} />
      <Section />
      <SkeletonCards count={4} min={220} lines={2} />
      <SkeletonCard lines={0} height={220} />
      <Section />
      <SkeletonColumns min={340}>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </SkeletonColumns>
    </ShellLoading>
  );
}
