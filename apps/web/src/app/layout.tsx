import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "UProperty Market",
  description:
    "Compre, venda e arrende imóveis diretamente, sem comissões nem contactos indesejados.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
