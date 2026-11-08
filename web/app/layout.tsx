import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Display: Anola once licensed — swap to next/font/local({ src: "./fonts/Anola.woff2", variable: "--font-display-face" }).
const display = Instrument_Serif({ variable: "--font-display-face", subsets: ["latin"], weight: "400", display: "swap" });
const sans = Instrument_Sans({ variable: "--font-sans-face", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "VeriBin — verifiable plastic collection", template: "%s · VeriBin" },
  description: "Every scan signed, chained and checkpointed. Collection evidence for EPR that anyone can verify.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
