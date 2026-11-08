import Link from "next/link"
import { cn } from "cn"

// Wordmark: a lit chain link (one record joined to the next) and the name in Inter Tight.
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5 font-display text-[22px] leading-none font-bold tracking-tight", className)}>
      <svg viewBox="0 0 32 20" className="h-5 w-8 transition-transform duration-500 ease-(--ease-spring) group-hover:rotate-[-8deg]" aria-hidden fill="none" strokeWidth="3">
        <ellipse cx="11" cy="10" rx="8.5" ry="6.5" stroke="var(--lit)" />
        <ellipse cx="21" cy="10" rx="8.5" ry="6.5" stroke="var(--violet)" />
      </svg>
      VeriBin
    </Link>
  )
}

export function PublicIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <div className="relative mx-auto max-w-[1200px] px-4 pt-20 pb-14 sm:px-6 lg:pt-28 lg:pb-20">
        <p className="neu-pill reveal mb-5 inline-block rounded-full px-3.5 py-1 text-xs font-semibold tracking-[0.12em] text-ink uppercase"><span aria-hidden className="mr-2 inline-block size-1.5 rounded-full bg-orchid align-middle" />{eyebrow}</p>
        <h1 className="t-h1 reveal max-w-3xl" style={{ animationDelay: "100ms" }}>{title}</h1>
        {children && <div className="reveal mt-5 max-w-[60ch] text-base text-ink/80 lg:text-lg lg:leading-7" style={{ animationDelay: "200ms" }}>{children}</div>}
      </div>
    </section>
  )
}

export const Section = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section data-reveal className={cn("mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24", className)}>{children}</section>
)
