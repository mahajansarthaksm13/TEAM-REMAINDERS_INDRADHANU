import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"

export const metadata: Metadata = { title: "About" }

// Content [FILL] — team names and roadmap dates to be confirmed by Team REMAINDERS.
const ROADMAP = [
  ["Now", "Prototype: signed scans, hash chain, nightly checkpoints, verifiable reports, website simulator."],
  ["Next", "Pilot bins in Pune with one producer; auditor workflow on real data."],
  ["Later", "Regulator onboarding and more EPR streams once the plastic flow is proven."],
]

export default function AboutPage() {
  return (
    <>
      <PublicIntro eyebrow="About" title="Built by Team REMAINDERS.">
        <p>VeriBin is our entry to the PCCoE International Grand Challenge 2026 under the theme AI for Climate Change.</p>
      </PublicIntro>
      <Section className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-3 text-dim">Theme</p>
          <h2 className="t-h2">AI for Climate Change</h2>
          <p className="mt-4 max-w-[56ch] text-dim">Extended Producer Responsibility only works if collection claims are true. We make them checkable — and use AI to watch the evidence, not to replace it.</p>
          <p className="eyebrow mt-10 mb-3 text-dim">Team</p>
          <p className="text-dim">Team member names and roles — to be added.</p>
        </div>
        <div className="lg:col-span-7">
          <p className="eyebrow mb-3 text-dim">Roadmap</p>
          <ol className="space-y-4">
            {ROADMAP.map(([k, v], i) => (
              <li key={k} className={i === 0 ? "skeu-raised rounded-card border-l-4 border-l-lit p-6 text-ink" : "skeu-raised rounded-card p-6 text-ink"}>
                <p className="t-h3">{k}</p>
                <p className="mt-2 max-w-[56ch] opacity-90">{v}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>
    </>
  )
}
