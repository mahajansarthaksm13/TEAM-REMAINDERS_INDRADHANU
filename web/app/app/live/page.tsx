import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, CategoryBar, EmptyState, KpiCard, PageHeader, ScoreText } from "@/components/vb/ui"
import { HeroStat, Momentum, PaceChart, PillBars, ShareDonut, TrendChart } from "@/components/vb/charts"
import { LiveFeed } from "@/components/vb/live-feed"
import { atRiskByCategory, binList, codeMix, flowTotals, kpis, latestFeed, monthlyTrend } from "@/lib/data"
import { momentum, pctDelta, windowValues } from "@/lib/chart-math"
import { href, pageCtx } from "@/lib/session"
import { completeDays, fyKey, fyMonths, monthsElapsed, recentDays } from "@/lib/period"
import { kg, num, timeAgo } from "@/lib/format"
import { CATEGORIES, cityName } from "@/lib/shared"

export const metadata: Metadata = { title: "Live Data" }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default async function LivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, period, sp } = await pageCtx(searchParams)
  const cid = scope.companyId
  // Recent windows run up to today (IST), whatever period is selected: "how is this week going?"
  const w7 = recentDays(7)
  const c7 = completeDays(7) // week-on-week changes compare whole days only
  const w30 = recentDays(30)
  const [k, trendMap, risk, bins, feed, recent30, mix] = await Promise.all([
    kpis(sb, period.from, period.to, cid),
    monthlyTrend(sb, `${period.fy}-04-01`, `${period.fy + 1}-03-31`, cid),
    atRiskByCategory(sb, fyKey(period.fy), cid),
    binList(sb, cid),
    latestFeed(sb, cid),
    flowTotals(sb, w30.days[0], w30.to, cid),
    codeMix(sb, w7.days[0], w7.to, cid),
  ])
  const trend = fyMonths(period.fy).map((m) => ({
    month: MON[+m.slice(5) - 1],
    ...Object.fromEntries(CATEGORIES.map((c) => [c, +(trendMap.get(m)?.[c] ?? 0).toFixed(2)])),
  })) as Parameters<typeof TrendChart>[0]["data"]
  const gap = Math.max(0, k.target_kg - k.total_kg)
  const activeBins = bins.filter((b) => b.status === "active").length
  const recent = [...bins].sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? "")).slice(0, 7)
  const scans = (extra: Record<string, string> = {}) => href("/app/scans", sp, extra)
  const elapsed = monthsElapsed(period.fy)
  const monthly = trend.map((t) => ({ month: t.month, kg: CATEGORIES.reduce((a, c) => a + t[c], 0) }))
  const sum = (xs: { value: number }[]) => xs.reduce((a, x) => a + x.value, 0)
  const spark = windowValues(recent30.days, w30.days, (d) => d.kg)
  const kg7 = sum(windowValues(recent30.days, c7.days, (d) => d.kg))
  const kgPrev7 = sum(windowValues(recent30.days, c7.prev, (d) => d.kg))
  const scans7 = windowValues(recent30.days, w7.days, (d) => d.scans)
  const scansFull7 = sum(windowValues(recent30.days, c7.days, (d) => d.scans))
  const scansPrev7 = sum(windowValues(recent30.days, c7.prev, (d) => d.scans))
  const mixTotal = mix.qr + mix.barcode
  const qrPct = mixTotal > 0 ? Math.round((mix.qr / mixTotal) * 100) : 0
  const moves = momentum(trend, CATEGORIES, elapsed)
  const monthLabel = trend[Math.max(0, elapsed - 1)]?.month ?? "this month"

  return (
    <>
      <PageHeader eyebrow={`${scope.label} · ${period.label}`} title="Live Data" />

      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <div className="col-span-2">
          <HeroStat
            label={`Collected · ${period.label}`}
            value={kg(k.total_kg)}
            caption={`${num(k.scan_count)} signed scans · ${kg(kg7)} in the last 7 full days`}
            delta={pctDelta(kg7, kgPrev7)}
            deltaLabel="last 7 full days vs the 7 before"
            spark={spark}
          />
        </div>
        <KpiCard href={href("/app/targets", sp)} label="Target" value={kg(k.target_kg)} caption="Full financial-year target" />
        <KpiCard href={scans()} label="Gap" value={kg(gap)} caption={k.target_kg > 0 && gap === 0 ? "✓ Target met" : "Still to collect this FY"} />
      </div>

      {k.scan_count === 0 && (
        <div className="mt-6">
          <EmptyState>No scans in this period yet.</EmptyState>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <PillBars
            title="Signed scans"
            subtitle="Last 7 days · today so far, in Violet"
            total={num(sum(scans7))}
            delta={pctDelta(scansFull7, scansPrev7)}
            deltaLabel="last 7 full days vs the 7 before"
            data={scans7}
            unit="scans"
            legend={mixTotal > 0 ? [
              { label: "QR codes · one-time serials, strongest evidence", pct: qrPct, tone: "violet" },
              { label: "Barcodes · product-level", pct: 100 - qrPct, tone: "orchid" },
            ] : undefined}
          />
        </Card>
        <Card className="lg:col-span-7">
          <CardHead eyebrow="Momentum" title={`Category movement · ${monthLabel}`} />
          <Momentum rows={moves} monthLabel={monthLabel} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHead eyebrow="By EPR category" title="Collected vs FY target" />
          <div className="space-y-6">
            {k.rows.map((c) => (
              <CategoryBar key={c.category} category={c.category} collected={c.collected_kg} target={c.target_kg ?? 0} atRisk={risk[c.category]} href={scans({ category: c.category })} />
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-7">
          <CardHead eyebrow="Monthly trend" title={`FY ${period.fy}–${String(period.fy + 1).slice(2)}`} />
          <TrendChart data={trend} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHead eyebrow="Category mix" title={`What was collected · ${period.label}`} />
          <ShareDonut data={k.rows.map((r) => ({ category: r.category, kg: r.collected_kg }))} caption="in this period" />
        </Card>
        <Card className="lg:col-span-7">
          <CardHead eyebrow="Pace" title={`On track for the FY target?`} />
          <PaceChart monthly={monthly} target={k.target_kg} elapsed={elapsed} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <LiveFeed initial={feed} companyId={cid} scanHref={href("", sp)} />
        </Card>
        <Card className="lg:col-span-4">
          <CardHead eyebrow={`Bins · ${num(activeBins)} active`} title="Recently seen" action={<Link href={href("/app/bins", sp)} className="text-sm font-semibold text-dim underline-offset-4 hover:underline">All bins</Link>} />
          {recent.length === 0 ? (
            <p className="text-sm text-dim">No bins registered.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((b) => (
                <li key={b.bin_id}>
                  <Link href={href(`/app/bins/${b.bin_id}`, sp)} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:bg-panel-hi">
                    <span>
                      <span className="font-mono font-semibold">{b.bin_id}</span>
                      <span className="block text-xs text-dim">{cityName(b.city)} · {b.last_seen ? timeAgo(b.last_seen) : "never reported"}</span>
                    </span>
                    <ScoreText score={b.trust_score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
