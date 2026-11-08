import Link from "next/link"
import { cn } from "cn"

// Wordmark. ponytail: text-only until the Anola logo treatment lands.
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("font-display text-[28px] leading-none tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", className)}>
      VeriBin
    </Link>
  )
}

export function PublicIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="dark-band relative isolate overflow-hidden">
      <MossBackdrop className="opacity-80" />
      <div className="relative mx-auto max-w-[1200px] px-4 pt-20 pb-14 sm:px-6 lg:pt-28 lg:pb-20">
        <p className="eyebrow reveal mb-4 text-sage-500">{eyebrow}</p>
        <h1 className="t-h1 reveal max-w-3xl" style={{ animationDelay: "100ms" }}>{title}</h1>
        {children && <div className="reveal mt-5 max-w-[60ch] text-base text-garden-50/80 lg:text-lg lg:leading-7" style={{ animationDelay: "200ms" }}>{children}</div>}
      </div>
    </section>
  )
}

export const Section = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section className={cn("mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24", className)}>{children}</section>
)

// Stand-in for dark moss photography: layered gradients + grain. Replace with <Image> under the same overlay. [FILL: imagery]
export function MossBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 78% 30%, rgba(139,150,120,0.45), transparent 70%), radial-gradient(45% 40% at 20% 75%, rgba(74,84,61,0.7), transparent 70%), radial-gradient(35% 30% at 55% 85%, rgba(215,222,200,0.12), transparent 70%), linear-gradient(160deg, #2a3322 0%, #1f261a 55%, #161b12 100%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.18] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-olive-950 via-olive-950/30 to-transparent" />
    </div>
  )
}
