import { useTranslations } from "next-intl";
import { Skeleton, SkeletonField, SkeletonPage } from "@upm/ui";

import { setLocalePreference } from "../app/actions/preferences";
import { AuthCard } from "./AuthCard";
import { RouteLoading } from "./RouteLoading";

/**
 * Esqueletos do interno — o que os `loading.tsx` desenham (19 nov 2026)
 * =========================================================================
 * Cada rota tem o seu `loading.tsx`, com a forma do seu ecrã; estas são as
 * duas molduras onde eles entram: a do shell (Admin, Suporte, Marketing) e a
 * dos ecrãs de entrada.
 *
 * A server action do idioma passa daqui, de um componente de servidor, para
 * o `RouteLoading` — como fazem as páginas. Importá-la dentro de um ficheiro
 * `"use client"` arrastava o `next/headers` para o browser (ver o
 * `InternalChrome`).
 */
export function ShellLoading({
  fill = false,
  gap,
  children,
}: {
  fill?: boolean;
  gap?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <RouteLoading fill={fill} onLocaleChange={setLocalePreference}>
      <SkeletonPage label={t("loading")} fill={fill} gap={gap}>
        {children}
      </SkeletonPage>
    </RouteLoading>
  );
}

/** Ecrãs de entrada: a moldura verdadeira e o formulário em esqueleto. */
export function AuthLoading({ fields = 2 }: { fields?: number }) {
  const t = useTranslations("common");
  return (
    <AuthCard>
      <SkeletonPage label={t("loading")} gap="var(--sp-7)">
        <div style={{ display: "grid", gap: "var(--sp-4)" }}>
          <Skeleton width="60%" height={30} radius="var(--r-lg)" />
          <Skeleton width="85%" height={14} />
        </div>
        {Array.from({ length: fields }, (_, i) => (
          <SkeletonField key={i} />
        ))}
        <Skeleton height="var(--h-md)" radius="var(--r-lg)" />
      </SkeletonPage>
    </AuthCard>
  );
}
