import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MasjidHub — Sovereign Mosque Operations & Governance",
  description: "Unified multi-tenant administrative ecosystem uniting prayer synchronicity, cryptographic donor stewardship, and community programmes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#fcfbfa] text-[#1c2421] selection:bg-[#c89b3c] selection:text-[#0d4734]">
        {children}
      </body>
    </html>
  );
}
