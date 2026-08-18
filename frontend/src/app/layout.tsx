import type { Metadata } from "next";
import { League_Spartan } from "next/font/google";
import "./globals.css";

const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

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
    <html lang="en" className={`${leagueSpartan.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fcfbfa] text-[#1c2421] selection:bg-[#c89b3c] selection:text-[#0d4734]">
        {children}
      </body>
    </html>
  );
}
