import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  title: "Prama | Institutional Security Deposit Oversight & Truth Engine",
  description: "Prama — AI-assisted verification, cryptographic forensic scrutiny, and statutory oversight of institutional fixed deposits for the AICTE Approval Bureau.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-amber-500/30 selection:text-amber-700 dark:selection:text-amber-200`}>
        <ThemeProvider>
          <Navigation />
          <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
