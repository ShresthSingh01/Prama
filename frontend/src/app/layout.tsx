import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navigation from "@/components/Navigation";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AICTE FDR-Sentinel | Financial Regulation Terminal",
  description: "Cryptographic trust, multi-tier provenance, forensic tamper detection, and risk intelligence for the AICTE Regulation Bureau.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 min-h-screen flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200`}>
        <Navigation />
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
