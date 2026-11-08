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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {/* Mounted once so it never remounts across navigation. */}
        <SmoothScroll />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
