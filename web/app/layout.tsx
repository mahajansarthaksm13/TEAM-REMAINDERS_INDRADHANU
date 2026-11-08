import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/vb/smooth-scroll";
import "./globals.css";

// Type, after the reference:
//  · Inter Tight: titles, numbers, controls; set tight for a crisp, confident headline.
//  · Inter: running text and small caps, built for screens at every size.
//  · JetBrains Mono: hashes, signatures and IDs, where 0/O and 1/l must never be confused.
const display = Inter_Tight({ variable: "--font-display-face", subsets: ["latin"], display: "swap" });
const body = Inter({ variable: "--font-body-face", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "VeriBin — verifiable plastic collection", template: "%s · VeriBin" },
  description: "Every scan signed, chained and checkpointed. Collection evidence for EPR that anyone can verify.",
  applicationName: "VeriBin",
  openGraph: {
    type: "website",
    siteName: "VeriBin",
    locale: "en_IN",
    title: "VeriBin — plastic collection you can prove",
    description: "Smart bins sign every packet they collect. Producers file EPR evidence that regulators can verify from a public ledger.",
  },
  twitter: { card: "summary", title: "VeriBin — plastic collection you can prove", description: "Signed, chained, publicly checkpointed plastic collection for EPR." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {/* Keyboard users jump past the navigation; every layout's <main> carries id="main". */}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-full focus:bg-violet focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-snow">
          Skip to content
        </a>
        {/* Mounted once so it never remounts across navigation. */}
        <SmoothScroll />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
