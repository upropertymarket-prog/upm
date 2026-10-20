import type { RouteSeo } from "@/lib/seo";

/**
 * SEO de `/entrar` (P3-02). `noindex`: um ecrã de sessão não se indexa.
 */
export const seo: RouteSeo = {
  pt: {
    pageName: "Entrar",
    titleTag: "Entrar · UProperty Market",
    metaDescription: "Acesso à sua conta UProperty Market.",
    noindex: true,
  },
  en: {
    pageName: "Sign in",
    titleTag: "Sign in · UProperty Market",
    metaDescription: "Access your UProperty Market account.",
    noindex: true,
  },
};
