import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, CategoryBar, EmptyState, KpiCard, PageHeader, ScoreText } from "@/components/vb/ui"
import { TrendChart } from "@/components/vb/charts"
import { LiveFeed } from "@/components/vb/live-feed"
import { atRiskByCategory, binList, kpis, latestFeed, monthlyTrend } from "@/lib/data"
import { href, pageCtx } from "@/lib/session"
import { fyKey, fyMonths } from "@/lib/period"
import { kg, num, timeAgo } from "@/lib/format"
import { CATEGORIES, cityName } from "@/lib/shared"

export const metadata: Metadata = { title: "Live Data" }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default async function LivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, period, sp } = await pageCtx(searchParams)
  const cid = scope.companyId
  const [k, trendMap, risk, bins, feed] = await Promise.all([
    kpis(sb, period.from, period.to, cid),
    monthlyTrend(sb, `${period.fy}-04-01`, `${period.fy + 1}-03-31`, cid),
    atRiskByCategory(sb, fyKey(period.fy), cid),
    binList(sb, cid),
    latestFeed(sb, cid),
  ])
  const trend = fyMonths(period.fy).map((m) => ({
    month: MON[+m.slice(5) - 1],
    ...Object.fromEntries(CATEGORIES.map((c) => [c, +(trendMap.get(m)?.[c] ?? 0).toFixed(2)])),
  })) as Parameters<typeof TrendChart>[0]["data"]
  const gap = Math.max(0, k.target_kg - k.total_kg)
  const activeBins = bins.filter((b) => b.status === "active").length
  const recent = [...bins].sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? "")).slice(0, 7)
  const scans = (extra: Record<string, string> = {}) => href("/app/scans", sp, extra)

  return (
    <>
      <PageHeader eyebrow={`${scope.label} · ${period.label}`} title="Live Data" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        <KpiCard href={scans()} label="Total collected" value={kg(k.total_kg)} caption={`${num(k.scan_count)} signed scans · catalogue weight`} />
        <KpiCard href={href("/app/targets", sp)} label="Target" value={kg(k.target_kg)} caption="Full financial-year target" />
        <KpiCard href={scans()} label="Gap" value={kg(gap)} caption={k.target_kg > 0 && gap === 0 ? "✓ Target met" : "Still to collect this FY"} />
        <KpiCard href={href("/app/bins", sp)} label="Active bins" value={num(activeBins)} caption="Registered and not revoked" />
      </div>

      {k.scan_count === 0 && (
        <div className="mt-6">
          <EmptyState>No scans in this period yet.</EmptyState>
        </div>
      )}

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
        <Card className="lg:col-span-8">
          <LiveFeed initial={feed} companyId={cid} scanHref={href("", sp)} />
        </Card>
        <Card className="lg:col-span-4">
          <CardHead eyebrow="Bins" title="Recently seen" action={<Link href={href("/app/bins", sp)} className="text-sm font-semibold text-olive-700 underline-offset-4 hover:underline">All bins</Link>} />
          {recent.length === 0 ? (
            <p className="text-sm text-olive-700">No bins registered.</p>
          ) : (
            <ul className="divide-y divide-sage-200">
              {recent.map((b) => (
                <li key={b.bin_id}>
                  <Link href={href(`/app/bins/${b.bin_id}`, sp)} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:bg-garden-50">
                    <span>
                      <span className="font-mono font-semibold">{b.bin_id}</span>
                      <span className="block text-xs text-olive-700">{cityName(b.city)} · {b.last_seen ? timeAgo(b.last_seen) : "never reported"}</span>
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
