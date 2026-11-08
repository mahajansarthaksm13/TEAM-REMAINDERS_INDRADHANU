import Link from "next/link"
import { cookies } from "next/headers"
import { hasSessionCookie } from "@/lib/shared"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cta } from "@/components/vb/magnetic"
import { GlowBackdrop } from "@/components/vb/brand"
import { SAMPLE_REPORT_ID, STEPS } from "@/lib/shared"

export default async function Home() {
  const loggedIn = hasSessionCookie(await cookies())
  return (
    <>
      <section className="relative isolate flex min-h-[72vh] items-center lg:min-h-[86vh]">
        <GlowBackdrop />
        <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 lg:pb-24">
          <p className="neu-pill reveal mb-7 rounded-full px-4 py-1.5 text-sm text-ink"><span aria-hidden className="mr-2 inline-block size-1.5 rounded-full bg-orchid align-middle" />Verifiable plastic collection for EPR</p>
          <h1 className="t-display reveal max-w-4xl" style={{ animationDelay: "120ms" }}>
            A small scan.
            <br />A bigger change.
          </h1>
          <p className="reveal mt-6 max-w-[56ch] text-base text-ink/75 lg:text-lg lg:leading-7" style={{ animationDelay: "240ms" }}>
            VeriBin bins sign every packet they collect. The records chain together and are checkpointed in public, so a recycling claim can be checked by anyone — without trusting us.
          </p>
          <div className="reveal mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: "360ms" }}>
            <Cta asChild size="lg" playOnLoad><Link href="/how-it-works#simulator">Try the simulator</Link></Cta>
            <Button asChild variant="secondary" size="lg"><Link href={loggedIn ? "/app/live" : "/login"}>Open dashboard</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24" aria-labelledby="problem">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <p data-reveal className="eyebrow mb-3 text-dim">The problem in numbers</p>
          <h2 data-reveal id="problem" className="t-h2 max-w-2xl">Paper certificates are easy to fake. Plastic is not easy to hide.</h2>
          <dl className="stagger mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["6 lakh", "EPR certificates flagged as fake in the plastic packaging system."],
              ["₹355 crore", "in environmental compensation proposed against non-compliant producers."],
              ["July 2024", "The National Green Tribunal took suo motu notice of fake EPR credits."],
            ].map(([v, d]) => (
              <div key={v} className="neu rounded-card p-6 transition-transform duration-500 ease-(--ease-spring) hover:-translate-y-1 lg:p-8">
                <dt className="font-display text-[40px] leading-none font-semibold tracking-[-0.03em] text-lit lg:text-[52px]">{v}</dt>
                <dd className="mt-4 max-w-[34ch] text-sm text-ink">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-dim">Figures pending confirmation before launch.</p>
        </div>
      </section>

      <section className="border-y border-line bg-deep/40 py-16 lg:py-24" aria-labelledby="evidence">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:items-center">
          <div data-reveal className="lg:col-span-7">
            <p className="eyebrow mb-3 text-dim">Why evidence matters</p>
            <h2 id="evidence" className="t-h2 max-w-xl">Every number has a receipt.</h2>
            <div className="mt-6 max-w-[60ch] space-y-4 text-base text-ink/80 lg:text-lg lg:leading-7">
              <p>A total on a dashboard is a promise. VeriBin turns it into proof: every kilogram traces back to signed scans, each linked to the last, each day sealed by a public checkpoint.</p>
              <p>Auditors and regulators don&apos;t need access to our servers to check a claim. A phone camera and the report&apos;s QR code are enough.</p>
            </div>
          </div>
          <figure data-reveal className="neu rounded-card p-6 lg:col-span-5" aria-label="Example of a signed scan record">
            <p className="eyebrow text-dim">Signed record · BIN-0001</p>
            <pre className="mt-3 overflow-x-auto font-mono text-[13px] leading-5 text-ink [overflow-wrap:anywhere] whitespace-pre-wrap">1|BIN-0001|4182|2026-10-25T08:15:03Z|VB1A3F9C2E…|24</pre>
            <dl className="mt-5 space-y-3 font-mono text-xs">
              {[
                ["Signature", "kC2l…Q9w=="],
                ["Record hash", "a3f9…7c21"],
                ["Previous hash", "51be…09d4"],
                ["Chain hash", "e07a…b3f8"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-t border-line pt-3">
                  <dt className="font-sans text-dim">{k}</dt>
                  <dd className="rounded-badge bg-chip px-2 py-0.5 text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <figcaption className="mt-5 text-sm text-dim">✓ Signature verified in the browser</figcaption>
          </figure>
        </div>
      </section>

      <section className="py-16 lg:py-24" aria-labelledby="how">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <p data-reveal className="eyebrow mb-3 text-dim">How it works</p>
          <h2 data-reveal id="how" className="t-h2">Four steps from packet to proof.</h2>
          <ol className="stagger mt-12 grid gap-0 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative flex gap-5 pb-8 lg:block lg:pb-0">
                {i < 3 && <span aria-hidden className="absolute top-10 bottom-0 left-5 w-px bg-line-strong lg:top-5 lg:right-0 lg:bottom-auto lg:left-14 lg:h-px lg:w-auto" />}
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full btn-lit font-display font-semibold text-snow">{s.n}</span>
                <Link href={`/how-it-works#step-${s.n}`} className="group block rounded-card lg:mt-6 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <h3 className="t-h3 flex items-center gap-2">
                    {s.title}
                    <ArrowRight className="size-5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </h3>
                  <p className="mt-2 max-w-[36ch] text-sm text-dim">{s.body}</p>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-16 lg:pb-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
          <div data-reveal className="neu relative isolate overflow-hidden rounded-card px-6 py-12 lg:px-12 lg:py-16">
            <GlowBackdrop className="opacity-70" />
            <div className="relative grid gap-6 lg:grid-cols-12 lg:items-end">
              <h2 className="t-h2 lg:col-span-7">See the proof yourself. It takes ten seconds.</h2>
              <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
                <Cta asChild size="lg"><Link href="/how-it-works#simulator">Try the simulator</Link></Cta>
                {SAMPLE_REPORT_ID ? (
                  <Button asChild variant="secondary" size="lg"><Link href={`/verify/${SAMPLE_REPORT_ID}`}>Verify a sample report</Link></Button>
                ) : (
                  <Button asChild variant="secondary" size="lg"><Link href="/checkpoints">See the checkpoints</Link></Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
