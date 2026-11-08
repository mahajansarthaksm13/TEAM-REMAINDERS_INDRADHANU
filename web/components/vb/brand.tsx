import Link from "next/link"
import { cn } from "cn"

// Wordmark: a lit chain link (one record joined to the next) and the name in Comfortaa.
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 font-display text-[22px] leading-none font-bold tracking-tight", className)}>
      <svg viewBox="0 0 32 20" className="h-5 w-8 transition-transform duration-500 ease-(--ease-spring) group-hover:rotate-[-8deg]" aria-hidden fill="none" strokeWidth="3">
        <ellipse cx="11" cy="10" rx="8.5" ry="6.5" stroke="var(--lit)" />
        <ellipse cx="21" cy="10" rx="8.5" ry="6.5" stroke="var(--sage-500)" />
      </svg>
      VeriBin
    </Link>
  )
}

export function PublicIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <MossBackdrop className="opacity-60" />
      <div className="relative mx-auto max-w-[1200px] px-4 pt-20 pb-14 sm:px-6 lg:pt-28 lg:pb-20">
        <p className="eyebrow reveal mb-4 text-dim">{eyebrow}</p>
        <h1 className="t-h1 reveal max-w-3xl" style={{ animationDelay: "100ms" }}>{title}</h1>
        {children && <div className="reveal mt-5 max-w-[60ch] text-base text-ink/80 lg:text-lg lg:leading-7" style={{ animationDelay: "200ms" }}>{children}</div>}
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
            "radial-gradient(55% 45% at 78% 28%, rgba(139,150,120,0.22), transparent 70%), radial-gradient(40% 35% at 18% 78%, rgba(74,84,61,0.35), transparent 70%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.12] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-ground/80 to-transparent" />
    </div>
  )
}
