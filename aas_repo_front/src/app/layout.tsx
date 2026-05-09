/*
 * 파일명: src/app/layout.tsx
 * 설명: Next.js 애플리케이션의 루트 레이아웃 컴포넌트.
 * shadcn/ui 기반으로 재작성 — Mantine / Bootstrap 번들 제거.
 */

import "../styles/globals.css";
import { Inter } from "next/font/google";
import ClientLayout from "../components/ClientLayout";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "KETI ezAAS Model Hub",
  description: "KETI ezAAS Model Hub — Central repository for AAS and Submodel Templates",
  keywords: "KETI, AAS, Asset Administration Shell, Digital Twin",
  openGraph: {
    locale: "en_US",
    type: "website",
    title: "KETI ezAAS Model Hub",
    siteName: "KETI ezAAS Model Hub",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tokenMessage = (await cookies()).get("token_message")?.value || "";

  return (
    <html lang="en" className={`h-full bg-background ${inter.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-icon-180x180.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/favicon/manifest.json" />
      </head>
      <body className="h-full font-sans antialiased">
        <ClientLayout tokenMessage={tokenMessage}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
