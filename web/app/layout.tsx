import type { Metadata } from "next";
import { Comfortaa, JetBrains_Mono, Jost } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Backdrop } from "@/components/vb/backdrop";
import "./globals.css";

// Type, the reference pairing:
//  · Comfortaa: monoline geometric with true-circle bowls; titles, copy, controls, numbers.
//  · Jost (a Futura revival): only the small tracked caps (eyebrows, table heads).
//  · JetBrains Mono: hashes, signatures and IDs, where 0/O and 1/l must never be confused.
const display = Comfortaa({ variable: "--font-display-face", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const caption = Jost({ variable: "--font-caption-face", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "VeriBin — verifiable plastic collection", template: "%s · VeriBin" },
  description: "Every scan signed, chained and checkpointed. Collection evidence for EPR that anyone can verify.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${caption.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {/* Mounted once so it never remounts across navigation. */}
        <Backdrop />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
