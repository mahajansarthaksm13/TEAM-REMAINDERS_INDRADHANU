import Link from "next/link"
import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"
import { CategoryBar, EmptyState } from "@/components/vb/ui"
import { Button } from "@/components/ui/button"
import { anonDb } from "@/lib/supabase"
import { CATEGORIES, type Category } from "@/lib/shared"
import { kg, num } from "@/lib/format"

export const metadata: Metadata = { title: "Live Data" }

export const dynamic = "force-dynamic"

export default async function LiveDataPage() {
  // get_public_stats(): national aggregates only, never one company, never demo data.
  const { data, error } = await anonDb().rpc("get_public_stats")
  if (error) throw new Error("get_public_stats failed")
  const row = data?.[0]
  const byCat = (row?.by_category ?? {}) as Partial<Record<Category, number>>
  const s = {
    by_category: CATEGORIES.map((category) => ({ category, kg: Number(byCat[category] ?? 0) })),
    scan_count: Number(row?.total_scans ?? 0),
    active_bins: Number(row?.active_bins ?? 0),
    cities: Number(row?.cities ?? 0),
  }
  const total = Number(row?.total_kg ?? 0)
  const max = Math.max(...s.by_category.map((c) => c.kg), 0.001)
  return (
    <>
      <PublicIntro eyebrow="Live Data" title="Collection, counted as it happens.">
        <p>Every bin streams signed scans to the ledger. These national totals come straight from it — no company split, simulator scans excluded.</p>
      </PublicIntro>
      <Section>
        {total === 0 ? (
          <EmptyState>Collection data will appear once bins start reporting.</EmptyState>
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            <dl className="grid grid-cols-2 gap-4 lg:col-span-5 lg:gap-6">
              {[
                ["Collected", kg(total)],
                ["Signed scans", num(s.scan_count)],
                ["Active bins", num(s.active_bins)],
                ["Cities", num(s.cities)],
              ].map(([k, v]) => (
                <div key={k} className="skeu-raised rounded-card p-4 sm:p-6">
                  <dt className="eyebrow text-dim">{k}</dt>
                  <dd className="t-kpi mt-2">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="skeu-raised rounded-card p-4 sm:p-6 lg:col-span-7">
              <p className="eyebrow text-dim">By EPR category</p>
              <div className="mt-5 space-y-6">
                {s.by_category.map((c) => (
                  <CategoryBar key={c.category} category={c.category} collected={c.kg} target={max} relative />
                ))}
              </div>
              <p className="mt-6 text-xs text-dim">Bars are relative to the largest category. Catalogue weights. Live as of page load.</p>
            </div>
          </div>
        )}
        <div className="mt-12 flex flex-col gap-4 rounded-card bg-chip p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
          <p className="max-w-[52ch]">Producers, auditors and regulators see the same numbers per company, down to each signed scan.</p>
          <Button asChild><Link href="/login">Open dashboard</Link></Button>
        </div>
      </Section>
    </>
  )
}
