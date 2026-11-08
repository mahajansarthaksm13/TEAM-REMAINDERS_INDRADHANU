import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"
import { Badge, Card, CardHead, ScoreText } from "@/components/vb/ui"
import { ForecastChart, type ForecastPoint } from "@/components/vb/charts"

export const metadata: Metadata = { title: "AI Insights" }

// Static, anonymised samples (App Flow §5.3) — no live data on this page.
const CARDS = [
  "Category III is on pace to finish 22% short of its FY target unless daily collection rises above 1.4 kg.",
  "Pune bins handled 41% of scans this month, up from 33% last month.",
  "One Bengaluru bin logged 14 scans within 60 seconds; they are counted as under review, not collected.",
]
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
const SAMPLE: ForecastPoint[] = MONTHS.map((m, i) => {
  const actual = i <= 6 ? Math.round(18 * (i + 1) + i * i * 1.6) : null
  const base = 18 * 7 + 36 * 1.6
  const proj = i >= 6 ? Math.round(base + (i - 6) * 26) : null
  return { month: m, actual, projected: proj, band: proj === null ? null : [Math.round(proj - (i - 6) * 6), Math.round(proj + (i - 6) * 6)] }
})

export default function AiInsightsPage() {
  return (
    <>
      <PublicIntro eyebrow="AI Insights" title="A second pair of eyes on every bin.">
        <p>Each night a job reads the day&apos;s scans, scores every bin for trust, projects each category against its target, and writes plain-language notes. The model narrates numbers that were computed first — it never invents them.</p>
      </PublicIntro>
      <Section>
        <p className="eyebrow mb-4 text-olive-700">Sample insight cards</p>
        <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
          {CARDS.map((c) => (
            <Card key={c}>
              <p className="text-base leading-6">{c}</p>
              <p className="mt-4 text-sm font-semibold text-olive-700">View scans →</p>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHead eyebrow="Sample forecast" title="Category III · against target" action={<Badge kind="warning">⚠ At risk</Badge>} />
            <ForecastChart data={SAMPLE} target={420} atRisk />
            <p className="mt-3 text-xs text-olive-700">Solid: collected so far. Dashed: projection at the last 30 days&apos; pace. Band: likely range. Dotted: FY target.</p>
          </Card>
          <Card className="lg:col-span-5">
            <CardHead eyebrow="Sample trust score" title="How a bin is scored" />
            <div className="flex items-center justify-between border-b border-sage-200 pb-3">
              <span className="font-mono text-sm">BIN-0009 · Bengaluru</span>
              <span className="text-2xl"><ScoreText score={44} /></span>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-4"><span>Burst of scans within 60 s</span><span className="tnum text-olive-700">−30</span></li>
              <li className="flex justify-between gap-4"><span>Weights drifting from catalogue</span><span className="tnum text-olive-700">−17</span></li>
              <li className="flex justify-between gap-4"><span>Minor weight variance</span><span className="tnum text-olive-700">−3</span></li>
            </ul>
            <p className="mt-4 text-sm text-olive-700">Bins with fewer than 20 scans show <em>Not enough data</em> instead of a score.</p>
          </Card>
        </div>
      </Section>
    </>
  )
}
