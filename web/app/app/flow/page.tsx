import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, CategorySwatch, DataTable, EmptyState, KpiCard, Notice, PageHeader } from "@/components/vb/ui"
import { CategoryStack, FlowSankey, ProductBars, ShareDonut } from "@/components/vb/charts"
import { flowTotals, productTotals } from "@/lib/data"
import { flowInsights, stackBy } from "@/lib/chart-math"
import { href, pageCtx } from "@/lib/session"
import { kg, num } from "@/lib/format"
import { CATEGORIES, CATEGORY_LABEL, cityName } from "@/lib/shared"

export const metadata: Metadata = { title: "Where waste goes" }

// Follows every kilogram from the company whose packaging it was, through its EPR category, to the
// city whose bins collected it, and down to each product. Built for three readers: a producer
// checking its own footprint, an admin comparing companies, and a regulator auditing the totals.
export default async function FlowPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, period, sp, companies, readOnly } = await pageCtx(searchParams)
  const cid = scope.companyId
  const [flow, prods] = await Promise.all([flowTotals(sb, period.from, period.to, cid), productTotals(sb, period.from, period.to, cid)])
  const rows = flow.rows
  const total = rows.reduce((a, r) => a + r.kg, 0)
  const coName = new Map(companies.map((c) => [c.id, c.name]))

  const byCompany = stackBy(rows, (r: (typeof rows)[number]) => r.company_id, CATEGORIES).map((r) => ({ ...r, name: coName.get(r.key) ?? rows.find((x) => x.company_id === r.key)?.company ?? "Company" }))
  const byCity = stackBy(rows, (r: (typeof rows)[number]) => r.city, CATEGORIES).map((r) => ({ ...r, name: cityName(r.key) }))
  const byCategory = CATEGORIES.map((c) => ({ category: c, kg: rows.filter((r) => r.category === c).reduce((a, r) => a + r.kg, 0) }))
  const products = prods.rows.map((p) => ({ ...p, company: coName.get(p.company_id) }))
  const insights = flowInsights({
    total,
    byCompany: byCompany.map((c) => ({ name: c.name, kg: c.total })),
    byCity: byCity.map((c) => ({ name: c.name, kg: c.total })),
    byCategory: byCategory.map((c) => ({ name: CATEGORY_LABEL[c.category], kg: c.kg })),
    products: products.map((p) => ({ name: p.name, kg: p.kg })),
  })
  const productTotal = products.reduce((a, p) => a + p.kg, 0)
  const multi = byCompany.length > 1
  const scans = (extra: Record<string, string> = {}) => href("/app/scans", sp, extra)

  return (
    <>
      <PageHeader
        eyebrow={`${scope.label} · ${period.label}`}
        title="Where waste goes"
        desc="Follow every kilogram from the company whose packaging it was, through its EPR category, to the city whose bins collected it. Every number links to the signed scans behind it."
      />

      {(flow.truncated || prods.truncated) && (
        <div className="mb-6"><Notice kind="warning">This period holds more records than the page reads at once, so figures are partial. Pick a shorter period for complete numbers.</Notice></div>
      )}

      {total === 0 ? (
        <EmptyState>Nothing was collected in this period. Try a longer period from the selector at the top.</EmptyState>
      ) : (
        <>
          <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            <KpiCard href={scans()} label="Collected" value={kg(total)} caption="Catalogue weight, demo bins excluded" />
            <KpiCard href={href("/app/flow", sp)} label={multi ? "Companies" : "Categories"} value={num(multi ? byCompany.length : byCategory.filter((c) => c.kg > 0).length)} caption="With collected waste" />
            <KpiCard href={href("/app/bins", sp)} label="Cities" value={num(byCity.length)} caption="Where it was collected" />
            <KpiCard href={href("/app/catalogue", sp)} label="Products" value={num(products.length)} caption="Seen in at least one scan" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHead eyebrow="Insights" title="What the numbers say" />
              <ol className="space-y-4">
                {insights.map((t, i) => (
                  <li key={t} className="flex gap-3 text-sm leading-6">
                    <span aria-hidden className="neu-press flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-lit">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 border-t border-line pt-4 text-xs text-dim">
                {readOnly ? "Read-only view for audit. " : ""}Totals come from the same daily totals as the Live Data KPIs, so they reconcile exactly.
              </p>
            </Card>
            <Card className="lg:col-span-8">
              <CardHead eyebrow="Flow" title="From producer to collection city" />
              <FlowSankey rows={rows} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            {multi ? (
              <Card className="lg:col-span-7">
                <CardHead eyebrow="By company" title="Who the collected waste belongs to" />
                <CategoryStack
                  label="Collected waste per company by category"
                  data={byCompany}
                  takeaway={<><strong>{byCompany[0].name}</strong> accounts for {Math.round((byCompany[0].total / total) * 100)}% of collected waste across {byCompany.length} companies.</>}
                />
              </Card>
            ) : (
              <Card className="lg:col-span-7">
                <CardHead eyebrow="By category" title="What kind of packaging it is" />
                <ShareDonut data={byCategory} caption="in this period" />
              </Card>
            )}
            <Card className="lg:col-span-5">
              <CardHead eyebrow="By city" title="Where it ends up" />
              <CategoryStack
                label="Collected waste per city by category"
                data={byCity}
                takeaway={<>{byCity.length > 1 ? <><strong>{byCity[0].name}</strong> collects {Math.round((byCity[0].total / total) * 100)}% of it.</> : <>All of it is collected in <strong>{byCity[0].name}</strong>.</>} Open a city in Scans to see each signed record.</>}
              />
              <ul className="mt-4 flex flex-wrap gap-2">
                {byCity.map((c) => (
                  <li key={c.key}>
                    <Link href={scans({ city: c.key })} className="neu-pill inline-flex h-9 items-center rounded-full px-3.5 text-xs font-semibold text-lit underline-offset-4 hover:underline">
                      {c.name} scans →
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHead eyebrow="By product" title={multi ? "Each company's products, by weight collected" : "Your products, by weight collected"} />
            {products.length === 0 ? (
              <p className="text-sm text-dim">No product scans in this period.</p>
            ) : (
              <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <ProductBars products={products} />
                </div>
                <div className="lg:col-span-7">
                  <DataTable
                    rows={products.slice(0, 25)}
                    rowKey={(p) => p.product_id}
                    rowHref={(p) => scans({ product: p.product_id })}
                    title={(p) => p.name}
                    caption="Products by collected weight"
                    cols={[
                      { key: "name", label: "Product", cell: (p) => p.name },
                      ...(multi ? [{ key: "company", label: "Company", cell: (p: (typeof products)[number]) => p.company ?? "—" }] : []),
                      { key: "cat", label: "Category", cell: (p) => <span className="inline-flex items-center gap-2"><CategorySwatch category={p.category} />{CATEGORY_LABEL[p.category]}</span> },
                      { key: "scans", label: "Scans", align: "right", cell: (p) => num(p.scans) },
                      { key: "kg", label: "Weight", align: "right", cell: (p) => kg(p.kg) },
                      { key: "share", label: "Share", align: "right", cell: (p) => `${productTotal > 0 ? Math.round((p.kg / productTotal) * 100) : 0}%` },
                    ]}
                  />
                  {products.length > 25 && <p className="mt-3 text-xs text-dim">Showing the top 25 of {num(products.length)} products.</p>}
                </div>
              </div>
            )}
            <p className="mt-6 border-t border-line pt-4 text-xs text-dim">Product weight = accepted scans × the product&apos;s approved catalogue weight. Select a row to open its signed scans.</p>
          </Card>
        </>
      )}
    </>
  )
}
