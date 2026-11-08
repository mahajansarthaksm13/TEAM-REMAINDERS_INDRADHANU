import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Building2, ShieldCheck, UserCog } from "lucide-react"
import { Wordmark } from "./brand"

// Shared frame for the login flow (/login, /set-password). Left: a raised neumorphic frame holding a
// photo stage that cross-fades three duotone photographs. Right: the raised form card.
// Photos: Unsplash License (free to use, no permission needed), served from Unsplash's CDN.
const PHOTOS = [
  { id: "photo-1595278069441-2cf29f8005a4", alt: "A pile of plastic bottles and cans waiting for recycling" },
  { id: "photo-1642631171488-23d631eba638", alt: "Plastic bottles compressed in a recycling cage" },
  { id: "photo-1571727153934-b9e0059b7ab2", alt: "Rows of plastic bottles" },
]
const src = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=70`

// Who signs in here, and what each sees once inside.
const ROLES = [
  { icon: Building2, who: "Producers", what: "Your collection, targets and evidence reports" },
  { icon: ShieldCheck, who: "Auditors & regulators", what: "Read-only access to the companies you oversee, down to each signed scan" },
  { icon: UserCog, who: "Admins", what: "Approvals, targets and user access" },
]

function Stage({ compact }: { compact?: boolean }) {
  return (
    <div className="auth-stage" aria-hidden={compact || undefined}>
      {PHOTOS.map((p, i) => (
        <div key={p.id} className="auth-photo">
          <Image src={src(p.id)} alt={compact ? "" : p.alt} fill priority={i === 0} sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>
      ))}
      <div className="auth-tone-violet" />
      <div className="auth-tone-orchid" />
      {/* the short phone banner needs less fade, or the photo disappears */}
      <div className="auth-tone-fade" style={compact ? { background: "linear-gradient(180deg, rgba(23,17,35,0.25), rgba(23,17,35,0.7))" } : undefined} />
      {!compact && (
        <>
          <div className="auth-orbit" style={{ width: 460, height: 460, right: -150, top: -130, "--t": "46s" } as React.CSSProperties}><span /></div>
          <div className="auth-orbit" style={{ width: 260, height: 260, right: -30, top: -10, "--t": "28s", animationDirection: "reverse" } as React.CSSProperties}><span /></div>
        </>
      )}
    </div>
  )
}

export function AuthShell({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh gap-6 p-4 sm:p-6 lg:grid-cols-12 lg:gap-10 lg:p-8">
      {/* Desktop: the photo sits in a raised frame cut from the page. */}
      <aside className="neu hidden rounded-[28px] p-3 lg:col-span-7 lg:block">
        <div className="relative isolate flex h-full min-h-[560px] flex-col justify-between overflow-hidden rounded-[22px] p-10 text-snow">
          <Stage />
          <Wordmark className="relative text-snow" />
          <div className="relative max-w-xl">
            <p className="t-h1 reveal">Every number has a receipt.</p>
            <p className="reveal mt-4 max-w-md text-base text-snow/90" style={{ animationDelay: "120ms" }}>
              Signed scans, a public chain and evidence reports anyone can rebuild.
            </p>
            <div className="mt-10 flex items-center justify-between gap-4">
              <div className="flex gap-2" aria-hidden>
                {PHOTOS.map((p) => <span key={p.id} className="auth-dot block h-2 w-2 rounded-full" />)}
              </div>
              <p className="text-xs text-snow/80">Photos: Unsplash</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col gap-6 lg:col-span-5 lg:justify-center">
        {/* Phones: a short photo banner above the form. */}
        <div className="neu rounded-[24px] p-2 lg:hidden">
          <div className="relative isolate h-40 overflow-hidden rounded-[18px] text-snow sm:h-52">
            <Stage compact />
            <div className="relative flex h-full flex-col justify-between p-4 sm:p-6">
              <Wordmark className="text-snow" />
              <p className="t-h3 max-w-xs">Every number has a receipt.</p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[460px]">
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
          <ul className="cascade mt-6 grid gap-3" aria-label="Who uses VeriBin">
            {ROLES.map(({ icon: Icon, who, what }) => (
              <li key={who} className="neu-pill flex items-center gap-3 rounded-2xl px-4 py-3">
                <span aria-hidden className="neu-press flex size-9 shrink-0 items-center justify-center rounded-xl text-lit">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm">
                  <span className="font-semibold">{who}</span>
                  <span className="block text-dim">{what}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
