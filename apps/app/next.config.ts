import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@upm/ui", "@upm/db"],
  typedRoutes: true,
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Sem upload de source maps enquanto não houver SENTRY_AUTH_TOKEN no CI.
  disableLogger: true,
});
