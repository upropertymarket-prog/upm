import { useTranslations } from "next-intl";
import { SkeletonPage } from "@upm/ui";

import { setLocalePreference } from "../app/actions/preferences";
import { RouteLoading } from "./RouteLoading";

/**
 * A moldura dos `loading.tsx` da app (19 nov 2026)
 * =========================================================================
 * Cada rota tem o seu `loading.tsx`, com a forma do seu ecrã; esta é a
 * moldura onde entram. A server action do idioma passa daqui, de um
 * componente de servidor, para o `RouteLoading` — como fazem as páginas.
 */
export function ShellLoading({
  fill = false,
  contentWidth,
  gap,
  children,
}: {
  fill?: boolean;
  contentWidth?: "default" | "full";
  gap?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <RouteLoading fill={fill} contentWidth={contentWidth} onLocaleChange={setLocalePreference}>
      <SkeletonPage label={t("loading")} fill={fill} gap={gap}>
        {children}
      </SkeletonPage>
    </RouteLoading>
  );
}
