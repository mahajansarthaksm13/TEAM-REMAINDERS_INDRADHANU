import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, DataTable, EmptyState, Notice, PageHeader, ScoreText } from "@/components/vb/ui"
import { ForecastTabs, type ForecastData } from "@/components/vb/forecast-tabs"
import { binList, latestForecasts, monthlyTrend, targetsByCategory, type BinRow } from "@/lib/data"
import { href, pageCtx } from "@/lib/session"
import { fyKey, fyMonths } from "@/lib/period"
import { fmtDateTime, istDay } from "@/lib/format"
import { CATEGORIES, cityName, humanize } from "@/lib/shared"

export const metadata: Metadata = { title: "AI Insights" }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY = 86_400_000

type Detector = Record<string, { planted?: number; caught?: number; missed?: number; clean_scans?: number; flagged?: number }>

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, period, sp } = await pageCtx(searchParams)
  const cid = scope.companyId
  const fy = fyKey(period.fy)

  let cardsQ = sb.from("insights").select("id, company_id, week_start, kind, sentence, scan_filter, created_at").like("kind", "weekly_change_%").order("week_start", { ascending: false }).limit(40)
  if (cid) cardsQ = cardsQ.eq("company_id", cid)
  let accQ = sb.from("insights").select("payload, created_at").eq("kind", "detector_accuracy").order("created_at", { ascending: false }).limit(1)
  if (cid) accQ = accQ.eq("company_id", cid)

  const [{ data: cardRows }, { data: accRows }, fc, targets, trendMap, bins] = await Promise.all([
    cardsQ,
    accQ,
    latestForecasts(sb, fy, cid),
    targetsByCategory(sb, fy, cid),
    monthlyTrend(sb, `${period.fy}-04-01`, `${period.fy + 1}-03-31`, cid),
    binList(sb, cid),
  ])

  const latestWeek = cardRows?.[0]?.week_start
  const cards = (cardRows ?? []).filter((c) => c.week_start === latestWeek).slice(0, 8)
  const ranAt = fc.ranAt ?? cardRows?.[0]?.created_at ?? null
  // Nightly job runs ~01:30 IST; older than 26 h means a run was missed or stopped (e.g. integrity failure).
  const stale = !!ranAt && new Date().getTime() - Date.parse(ranAt) > 26 * 3_600_000

  // Forecast chart: cumulative actual per month, then a straight line to the FY-end projection with its range.
  const today = istDay(new Date())
  const thisMonth = today.slice(0, 7)
  const fyEnd = Date.parse(`${period.fy + 1}-03-31T12:00:00Z`)
  const now = Date.parse(`${today}T12:00:00Z`)
  const forecastData: ForecastData[] = CATEGORIES.map((cat) => {
    const f = fc.byCategory.get(cat)
    let cum = 0
    const points = fyMonths(period.fy).map((m) => {
      const label = MON[+m.slice(5) - 1]
      if (m <= thisMonth) {
        cum += trendMap.get(m)?.[cat] ?? 0
        const at = m === thisMonth && f ? +cum.toFixed(2) : null
        return { month: label, actual: +cum.toFixed(2), projected: at, band: at === null ? null : ([at, at] as [number, number]) }
      }
      if (!f) return { month: label, actual: null, projected: null, band: null }
      const monthEnd = Date.parse(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString())
      const t = Math.min(1, Math.max(0, (monthEnd - now) / Math.max(DAY, fyEnd - now)))
      const lerp = (end: number) => +(cum + (end - cum) * t).toFixed(2)
      return { month: label, actual: null, projected: lerp(f.projected_kg), band: [lerp(f.low_kg), lerp(f.high_kg)] as [number, number] }
    })
    return {
      category: cat,
      target_kg: targets[cat],
      projected_kg: f?.projected_kg ?? 0,
      low_kg: f?.low_kg ?? 0,
      high_kg: f?.high_kg ?? 0,
      collected_kg: cum,
      at_risk: !!f && f.projected_kg < targets[cat],
      points,
    }
  })

  const anomalies = [...bins].sort((a, b) => (a.trust_score ?? 101) - (b.trust_score ?? 101))
  const acc = accRows?.[0]?.payload as Detector | undefined
  const fraud = acc ? Object.entries(acc).filter(([k]) => k !== "false_alarms") : []
  const planted = fraud.reduce((a, [, v]) => a + (v.planted ?? 0), 0)
  const caught = fraud.reduce((a, [, v]) => a + (v.caught ?? 0), 0)

  const filterLink = (f: Record<string, string>) => href("/app/scans", { ...sp, company: f.company_id ?? sp.company }, { category: f.category, city: f.city, from: f.from, to: f.to })

  return (
    <>
      <PageHeader
        eyebrow={`${scope.label} · ${period.label}`}
        title="AI Insights"
        desc={<>{ranAt ? <>Last analysis {fmtDateTime(ranAt)}. </> : null}Numbers are computed first; the model only words them.</>}
      />
      {stale && <div className="mb-6"><Notice>Insights are older than usual. The nightly analysis may have stopped.</Notice></div>}

      {cards.length === 0 ? (
        <EmptyState>{ranAt ? "No big week-on-week changes to report." : "First analysis runs tonight at about 1:30 AM IST."}</EmptyState>
      ) : (
        <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4 lg:gap-6">
          {cards.map((c) => (
            <Card key={c.id} className="flex min-w-[78vw] snap-start flex-col justify-between gap-4 sm:min-w-0">
              <p className="text-base leading-6">{humanize(c.sentence ?? "")}</p>
              <Link href={filterLink(c.scan_filter as Record<string, string>)} className="text-sm font-semibold text-olive-700 underline-offset-4 hover:underline">View scans →</Link>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHead eyebrow="Forecast" title="Where each category will land by 31 March" />
        {fc.asOf ? <ForecastTabs data={forecastData} /> : <EmptyState>No forecast yet. It appears after the first nightly analysis.</EmptyState>}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead eyebrow="Anomalies" title="Bin trust scores" />
          {anomalies.length === 0 ? (
            <EmptyState>No bins registered.</EmptyState>
          ) : (
            <DataTable<BinRow>
              caption="Bins by trust score, lowest first"
              rows={anomalies}
              rowKey={(r) => r.bin_id}
              rowHref={(r) => href(`/app/bins/${r.bin_id}`, sp)}
              title={(r) => <span className="font-mono">{r.bin_id}</span>}
              cols={[
                { key: "bin", label: "Bin", cell: (r) => <span className="font-mono font-semibold">{r.bin_id}</span>, hideMobile: true },
                { key: "city", label: "City", cell: (r) => cityName(r.city) },
                { key: "score", label: "Trust score", align: "right", cell: (r) => <ScoreText score={r.trust_score} /> },
                { key: "why", label: "Main reasons", cell: (r) => (r.trust_reasons.length ? r.trust_reasons[0].detail : <span className="text-olive-700">—</span>) },
              ]}
            />
          )}
        </Card>
        <Card className="lg:col-span-4">
          <CardHead eyebrow="Detector accuracy" title="Against planted test fraud" />
          {!acc ? (
            <p className="text-sm text-olive-700">Not measured yet. It is recorded when the detector is evaluated against simulator ground truth.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="eyebrow text-olive-700">Caught</dt><dd className="t-kpi mt-1">{caught}/{planted}</dd></div>
                <div><dt className="eyebrow text-olive-700">False alarms</dt><dd className="t-kpi mt-1">{acc.false_alarms?.flagged ?? 0}</dd></div>
              </dl>
              <ul className="mt-4 space-y-1 text-sm">
                {fraud.map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3"><span>{k.replaceAll("_", " ")}</span><span className="tnum text-olive-700">{v.caught}/{v.planted}</span></li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-olive-700">False alarms out of {acc.false_alarms?.clean_scans ?? 0} clean scans. Measured {fmtDateTime(accRows![0].created_at)}.</p>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
