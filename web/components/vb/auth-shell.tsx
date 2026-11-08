import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Wordmark } from "./brand"

// Shared frame for the login flow (/login, /set-password): a photo stage that cross-fades three
// duotone photographs under orbiting chain links, and a raised form card that settles in.
// Photos: Unsplash License (free to use, no permission needed), served from Unsplash's CDN.
const PHOTOS = [
  { id: "photo-1595278069441-2cf29f8005a4", alt: "A pile of plastic bottles and cans waiting for recycling" },
  { id: "photo-1642631171488-23d631eba638", alt: "Plastic bottles compressed in a recycling cage" },
  { id: "photo-1571727153934-b9e0059b7ab2", alt: "Rows of plastic bottles" },
]
const src = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=70`

const POINTS = ["Every scan signed by the bin", "Each record chained to the last", "Daily checkpoints anyone can verify"]

function Stage({ compact }: { compact?: boolean }) {
  return (
    <div className="auth-stage" aria-hidden={compact || undefined}>
      {PHOTOS.map((p, i) => (
        <div key={p.id} className="auth-photo">
          <Image src={src(p.id)} alt={compact ? "" : p.alt} fill priority={i === 0} sizes="(min-width: 1024px) 58vw, 100vw" />
        </div>
      ))}
      <div className="auth-tone-violet" />
      <div className="auth-tone-orchid" />
      {/* the short phone banner needs less fade, or the photo disappears */}
      <div className="auth-tone-fade" style={compact ? { background: "linear-gradient(180deg, rgba(23,17,35,0.35), rgba(23,17,35,0.7))" } : undefined} />
      {!compact && (
        <>
          <div className="auth-orbit" style={{ width: 520, height: 520, right: -160, top: -120, "--t": "46s" } as React.CSSProperties}><span /></div>
          <div className="auth-orbit" style={{ width: 300, height: 300, right: -40, top: 0, "--t": "28s", animationDirection: "reverse" } as React.CSSProperties}><span /></div>
        </>
      )}
    </div>
  )
}

export function AuthShell({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-12">
      {/* Photo stage: full height beside the form on desktop, a banner above it on phones. */}
      <aside className="relative isolate hidden overflow-hidden lg:col-span-7 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Stage />
        <Wordmark className="relative" />
        <div className="relative max-w-xl">
          <p className="neu-pill reveal mb-6 inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold tracking-[0.12em] text-ink uppercase">
            <span aria-hidden className="mr-2 inline-block size-1.5 rounded-full bg-orchid" />
            Verifiable plastic collection
          </p>
          <p className="t-display reveal" style={{ animationDelay: "120ms" }}>Every number has a receipt.</p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((t, i) => (
              <li key={t} className="reveal flex items-center gap-3 text-base text-ink" style={{ animationDelay: `${300 + i * 120}ms` }}>
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet text-xs font-bold text-snow">{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex items-center justify-between gap-4">
            <div className="flex gap-2" aria-hidden>
              {PHOTOS.map((p) => <span key={p.id} className="auth-dot block h-2 w-2 rounded-full" />)}
            </div>
            <p className="text-xs text-dim">Photos: Unsplash</p>
          </div>
        </div>
      </aside>

      <div className="flex flex-col lg:col-span-5">
        <div className="relative isolate h-44 overflow-hidden sm:h-56 lg:hidden">
          <Stage compact />
          <div className="relative flex h-full flex-col justify-between p-4 sm:p-6">
            <Wordmark />
            <p className="t-h2 max-w-xs">Every number has a receipt.</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-10">
          <div className="w-full max-w-[440px]">
            <Link href="/" className="neu-pill mb-6 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to home
            </Link>
            <div className="neu auth-card rounded-card p-6 sm:p-8">
              <p className="eyebrow text-dim">{eyebrow}</p>
              <h1 className="t-h2 mt-1">{title}</h1>
              <div className="mt-2 text-sm text-dim">{desc}</div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
