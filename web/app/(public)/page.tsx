import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowRight, Building2, FileCheck2, Fingerprint, Link2, ShieldCheck, Stamp, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cta } from "@/components/vb/magnetic"
import { ShareDonut } from "@/components/vb/charts"
import { CategoryBar } from "@/components/vb/ui"
import { anonDb } from "@/lib/supabase"
import { kg, num } from "@/lib/format"
import { CATEGORIES, SAMPLE_REPORT_ID, STEPS, hasSessionCookie, type Category } from "@/lib/shared"

export const dynamic = "force-dynamic"

// National aggregates from the public ledger. The home page must never fail because of them:
// if the call errors, the live panel falls back to the signed-record example.
async function publicStats() {
  try {
    const { data, error } = await anonDb().rpc("get_public_stats")
    const row = data?.[0]
    if (error || !row) return null
    const byCat = (row.by_category ?? {}) as Partial<Record<Category, number>>
    return {
      kg: Number(row.total_kg ?? 0),
      scans: Number(row.total_scans ?? 0),
      bins: Number(row.active_bins ?? 0),
      cities: Number(row.cities ?? 0),
      byCategory: CATEGORIES.map((category) => ({ category, kg: Number(byCat[category] ?? 0) })),
    }
  } catch {
    return null
  }
}

const PROOF = [
  { icon: Fingerprint, title: "Signed at the bin", body: "Each scan carries the bin's own Ed25519 signature." },
  { icon: Link2, title: "Chained in order", body: "Every record holds the hash of the one before it." },
  { icon: Stamp, title: "Sealed in public", body: "Chain heads are checkpointed daily on GitHub." },
]

const AUDIENCES = [
  {
    icon: Building2,
    who: "Producers",
    need: "File EPR evidence that holds up.",
    get: "Live collection against your targets, where your packaging ends up, and Collection Evidence Reports with a QR anyone can check.",
    cta: { href: "/login", label: "Open your dashboard" },
  },
  {
    icon: ShieldCheck,
    who: "Regulators and auditors",
    need: "Check a claim without trusting the claimant.",
    get: "Read-only access down to each signed scan, plus public tools that rebuild any report from the ledger in your own browser.",
    cta: { href: SAMPLE_REPORT_ID ? `/verify/${SAMPLE_REPORT_ID}` : "/checkpoints", label: SAMPLE_REPORT_ID ? "Verify a sample report" : "See the public checkpoints" },
  },
  {
    icon: UserCog,
    who: "Administrators",
    need: "Run the network with a clear audit trail.",
    get: "Approve products against physical samples, set targets, manage access, and watch bin health and anomaly scores.",
    cta: { href: "/how-it-works", label: "See how it works" },
  },
]

const textLink = "inline-flex items-center gap-1.5 text-sm font-semibold text-lit underline decoration-lit/40 decoration-2 underline-offset-4 hover:decoration-lit"

export default async function Home() {
  const loggedIn = hasSessionCookie(await cookies())
  const stats = await publicStats()
  const maxCat = stats ? Math.max(...stats.byCategory.map((c) => c.kg), 0.001) : 1
  return (
    <>
      {/* ── Hero: the promise on the left, the live ledger proving it on the right ── */}
      <section className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pt-24 lg:pb-24">
        <div className="lg:col-span-7">
          <p className="neu-pill reveal mb-7 inline-flex items-center rounded-full px-4 py-1.5 text-sm text-ink">
            <span aria-hidden className="mr-2 inline-block size-1.5 rounded-full bg-orchid" />
            Verifiable plastic collection for India&apos;s EPR rules
          </p>
          <h1 className="t-display reveal max-w-[14ch]" style={{ animationDelay: "120ms" }}>
            Plastic collection you can prove.
          </h1>
          <p className="reveal mt-6 max-w-[54ch] text-base leading-7 text-dim lg:text-lg lg:leading-8" style={{ animationDelay: "240ms" }}>
            VeriBin bins sign every packet they collect. The records chain together and are sealed in public each day, so a producer&apos;s recycling claim can be checked by any auditor, regulator or citizen, without trusting anyone&apos;s spreadsheet.
          </p>
          <div className="reveal mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "360ms" }}>
            <Cta asChild size="lg" playOnLoad><Link href="/simulator">Try the simulator</Link></Cta>
            <Button asChild variant="secondary" size="lg"><Link href={loggedIn ? "/app/live" : "/login"}>{loggedIn ? "Open dashboard" : "Log in"}</Link></Button>
            <Link href="/live-data" className={`${textLink} h-12 px-2`}>
              See live national data <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>

        <aside className="neu reveal rounded-[28px] p-6 sm:p-8 lg:col-span-5" style={{ animationDelay: "200ms" }} aria-label="Live from the public ledger">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow text-dim">Live from the ledger</p>
            <span className="neu-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
              <span aria-hidden className="soft-pulse size-2 rounded-full bg-violet" />
              Live
            </span>
          </div>
          {stats && stats.kg > 0 ? (
            <>
              <dl className="mt-6 grid grid-cols-2 gap-4">
                {[
                  ["Plastic collected", kg(stats.kg)],
                  ["Signed scans", num(stats.scans)],
                  ["Active bins", num(stats.bins)],
                  ["Cities", num(stats.cities)],
                ].map(([k, v]) => (
                  <div key={k} className="neu-inset rounded-2xl p-4">
                    <dt className="text-xs text-dim">{k}</dt>
                    <dd className="tnum mt-1 font-display text-[24px] leading-8 font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-[28px]">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 space-y-4">
                {stats.byCategory.map((c) => (
                  <CategoryBar key={c.category} category={c.category} collected={c.kg} target={maxCat} relative />
                ))}
              </div>
              <p className="mt-5 text-xs text-dim">National totals at catalogue weight. Simulator scans never count.</p>
            </>
          ) : (
            <figure className="mt-6" aria-label="Example of a signed scan record">
              <pre className="neu-inset overflow-x-auto rounded-2xl p-4 font-mono text-[13px] leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap">1|VB-PUN-0001|4182|2026-10-25T08:15:03Z|qr|VB1A3F9C2E…|24</pre>
              <figcaption className="mt-4 text-sm text-dim">Live figures appear here as soon as bins report. This is what one signed scan looks like.</figcaption>
            </figure>
          )}
        </aside>
      </section>

      {/* ── Proof strip: the three guarantees, one line each ── */}
      <section aria-label="What makes a VeriBin number trustworthy" className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <ul className="neu stagger grid gap-6 rounded-[28px] p-6 sm:p-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {PROOF.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 md:px-6 md:first:pl-0 md:last:pr-0">
              <span aria-hidden className="neu-press flex size-11 shrink-0 items-center justify-center rounded-2xl text-lit"><Icon className="size-5" /></span>
              <span>
                <span className="block font-display font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-dim">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── The problem: one dominant number, two supporting ── */}
      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="problem">
        <div className="grid gap-10 lg:grid-cols-12">
          <div data-reveal className="lg:col-span-4">
            <p className="eyebrow mb-3 text-dim">The problem</p>
            <h2 id="problem" className="t-h2">Paper certificates are easy to fake. Plastic is not easy to hide.</h2>
            <p className="mt-4 max-w-[42ch] text-dim">EPR credits are traded on paperwork. VeriBin ties each kilogram to a physical scan that cannot be edited after the fact.</p>
          </div>
          <dl className="stagger grid gap-6 sm:grid-cols-2 lg:col-span-8">
            <div className="neu flex flex-col justify-between gap-6 rounded-[28px] p-8 sm:row-span-2">
              <dd className="font-display text-[64px] leading-none font-semibold tracking-[-0.04em] text-lit lg:text-[88px]">6 lakh</dd>
              <dt className="max-w-[30ch] text-dim">EPR certificates flagged as fake in the plastic packaging system.</dt>
            </div>
            <div className="neu rounded-[28px] p-6">
              <dd className="font-display text-[36px] leading-none font-semibold tracking-[-0.03em]">₹355 crore</dd>
              <dt className="mt-3 text-sm text-dim">in environmental compensation proposed against non-compliant producers.</dt>
            </div>
            <div className="neu rounded-[28px] p-6">
              <dd className="font-display text-[36px] leading-none font-semibold tracking-[-0.03em]">July 2024</dd>
              <dt className="mt-3 text-sm text-dim">The National Green Tribunal took suo motu notice of fake EPR credits.</dt>
            </div>
          </dl>
        </div>
        <p className="mt-6 text-xs text-dim lg:text-right">Figures pending confirmation before launch.</p>
      </section>

      {/* ── Who it serves: three readers, each with a next step ── */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:pb-28" aria-labelledby="audiences">
        <div className="grid gap-10 lg:grid-cols-12">
          <div data-reveal className="lg:col-span-4">
            <p className="eyebrow mb-3 text-dim">Who it serves</p>
            <h2 id="audiences" className="t-h2">One ledger, three readers.</h2>
            <p className="mt-4 max-w-[40ch] text-dim">Everyone sees the same signed records. What changes is what they need from them.</p>
          </div>
          <ul className="stagger space-y-5 lg:col-span-8">
            {AUDIENCES.map(({ icon: Icon, who, need, get, cta }) => (
              <li key={who} className="neu grid gap-4 rounded-[28px] p-6 sm:grid-cols-[auto_1fr] sm:gap-6">
                <span aria-hidden className="neu-press flex size-12 items-center justify-center rounded-2xl text-lit"><Icon className="size-5" /></span>
                <div>
                  <p className="font-display text-lg font-semibold">{who}</p>
                  <p className="text-sm font-medium">{need}</p>
                  <p className="mt-2 max-w-[62ch] text-sm leading-6 text-dim">{get}</p>
                  <Link href={cta.href} className={`${textLink} mt-3`}>
                    {cta.label} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:pb-28" aria-labelledby="how">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-3 text-dim">How it works</p>
            <h2 id="how" className="t-h2">Four steps from packet to proof.</h2>
          </div>
          <Link href="/how-it-works" className={textLink}>
            The full walkthrough <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="stagger mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n}>
              <Link href={`/how-it-works#step-${s.n}`} className="neu group flex h-full flex-col rounded-[28px] p-6 transition-transform duration-500 ease-(--ease-spring) hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <span className="flex items-center justify-between">
                  <span className="btn-lit flex size-10 items-center justify-center rounded-full font-display font-semibold text-snow">{s.n}</span>
                  <ArrowRight className="size-5 text-dim transition-transform duration-300 group-hover:translate-x-1 group-hover:text-lit" aria-hidden />
                </span>
                <span className="t-h3 mt-6 block">{s.title}</span>
                <span className="mt-2 block text-sm leading-6 text-dim">{s.body}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ── What is being collected: the national mix, live ── */}
      {stats && stats.kg > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:pb-28" aria-labelledby="mix">
          <div className="neu grid gap-10 rounded-[28px] p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
            <div data-reveal className="lg:col-span-5">
              <p className="eyebrow mb-3 text-dim">What is being collected</p>
              <h2 id="mix" className="t-h2">{kg(stats.kg)} of plastic, by EPR category.</h2>
              <p className="mt-4 max-w-[44ch] text-dim">Producers see the same split for their own packaging, and which cities&apos; bins collected it, on the Where waste goes page of their dashboard.</p>
              <Link href="/live-data" className={`${textLink} mt-6`}>
                Explore live data <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div data-reveal className="lg:col-span-7">
              <ShareDonut data={stats.byCategory} caption="nationally" />
            </div>
          </div>
        </section>
      )}

      {/* ── Close ── */}
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6" aria-labelledby="close">
        <div data-reveal className="neu grid gap-8 rounded-[28px] p-8 sm:p-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <h2 id="close" className="t-h2">See the proof yourself. It takes ten seconds.</h2>
            <p className="mt-3 max-w-[48ch] text-dim">Send one sample packet through the simulator and verify its signature in your own browser.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Cta asChild size="lg"><Link href="/simulator">Try the simulator</Link></Cta>
            <Button asChild variant="secondary" size="lg">
              <Link href={SAMPLE_REPORT_ID ? `/verify/${SAMPLE_REPORT_ID}` : "/reports"}>
                <FileCheck2 aria-hidden />
                {SAMPLE_REPORT_ID ? "Verify a sample report" : "How reports work"}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
