import Link from "next/link"
import type { Metadata } from "next"
import { cn } from "cn"
import { Badge, Card, CategoryBar, EmptyState, PageHeader } from "@/components/vb/ui"
import { atRiskByCategory, kpis } from "@/lib/data"
import { href, one, pageCtx } from "@/lib/session"
import { fyKey, fyLabel } from "@/lib/period"
import { kg, pct } from "@/lib/format"
import { CATEGORY_DESC, CATEGORY_LABEL } from "@/lib/shared"

export const metadata: Metadata = { title: "Targets" }

export default async function TargetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, period, sp } = await pageCtx(searchParams)
  const [k, risk] = await Promise.all([
    kpis(sb, `${period.fy}-04-01`, `${period.fy + 1}-03-31`, scope.companyId),
    atRiskByCategory(sb, fyKey(period.fy), scope.companyId),
  ])
  const t = k.rows.map((r) => ({ category: r.category, target_kg: r.target_kg ?? 0, collected_kg: r.collected_kg, at_risk: risk[r.category] }))
  const focus = one(sp.category)
  const total = k.target_kg
  const got = k.total_kg
  return (
    <>
      <PageHeader eyebrow={scope.label} title="Targets" desc={`${fyLabel(period.fy)} EPR targets. Targets are set by the admin. At risk means the latest nightly forecast falls short.`} />
      {total === 0 ? (
        <EmptyState>No targets set for this financial year.</EmptyState>
      ) : (
        <>
          <Card>
            <div className="grid gap-6 sm:grid-cols-3">
              <div><p className="eyebrow text-olive-700">Collected</p><p className="t-kpi mt-1">{kg(got)}</p></div>
              <div><p className="eyebrow text-olive-700">FY target</p><p className="t-kpi mt-1">{kg(total)}</p></div>
              <div><p className="eyebrow text-olive-700">Progress</p><p className="t-kpi mt-1">{pct(got, total)}%</p></div>
            </div>
          </Card>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {t.map((x) => (
              <Card key={x.category} id={x.category} className={cn(focus === x.category && "border-olive-700 ring-2 ring-olive-700/20")}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow text-olive-700">{CATEGORY_DESC[x.category]}</p>
                    <h2 className="t-h3 mt-1">{CATEGORY_LABEL[x.category]}</h2>
                  </div>
                  {x.at_risk ? <Badge kind="warning">⚠ At risk</Badge> : <Badge kind="ok">✓ On track</Badge>}
                </div>
                <CategoryBar category={x.category} collected={x.collected_kg} target={x.target_kg} href={href("/app/scans", sp, { category: x.category, period: `FY${period.fy}` })} />
                <p className="mt-4 text-sm text-olive-700">
                  Remaining gap <strong className="tnum text-olive-950">{kg(Math.max(0, x.target_kg - x.collected_kg))}</strong>
                  {x.at_risk && <> · forecast falls short — <Link href={href("/app/insights", sp)} className="font-semibold underline-offset-4 hover:underline">see forecast</Link></>}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}
