import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "UProperty Market",
  description: "Área de comprador e proprietário.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
