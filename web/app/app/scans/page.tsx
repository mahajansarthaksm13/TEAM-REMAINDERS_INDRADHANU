import Link from "next/link"
import Form from "next/form"
import type { Metadata } from "next"
import { SlidersHorizontal } from "lucide-react"
import { AutoSubmit } from "@/components/vb/client"
import { Badge, CategorySwatch, DataTable, EmptyState, PageHeader, Pagination, TierBadge, WeightBadge } from "@/components/vb/ui"
import { binList, listScans, PAGE } from "@/lib/data"
import { href, one, pageCtx } from "@/lib/session"
import { CATEGORIES, CATEGORY_LABEL, UUID_RE, cityName, isCategory, type FeedRow } from "@/lib/shared"
import { fmtDateTime, num } from "@/lib/format"

export const metadata: Metadata = { title: "Scans" }

const field = "h-10 w-full neu-inset rounded-input text-ink px-3 text-sm focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none"

export default async function ScansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, period, sp } = await pageCtx(searchParams)
  // URL values go straight into typed columns (enum, uuid, date): drop anything malformed instead of erroring.
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined)
  const cat = one(sp.category)
  const prod = one(sp.product)
  const f = {
    category: isCategory(cat) ? cat : undefined,
    product: prod && UUID_RE.test(prod) ? prod : undefined,
    bin: one(sp.bin),
    city: one(sp.city),
    from: day(one(sp.from)) ?? period.from,
    to: day(one(sp.to)) ?? period.to,
    page: Math.min(10_000, Math.max(1, Number(one(sp.page)) || 1)),
  }
  let prodQ = sb.from("products").select("id, name").order("name")
  if (scope.companyId) prodQ = prodQ.eq("company_id", scope.companyId)
  const [{ rows, total }, bins, { data: products }] = await Promise.all([listScans(sb, scope.companyId, f), binList(sb, scope.companyId), prodQ])
  const opts = { products: products ?? [], bins: bins.map((b) => b.bin_id), cities: [...new Set(bins.map((b) => b.city))] }
  const filtered = !!(f.category || f.product || f.bin || f.city || one(sp.from) || one(sp.to))
  const pageHref = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) q.set(k, v)
    q.set("page", String(p))
    return `/app/scans?${q}`
  }

  const filters = (
    <Form action="/app/scans" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {one(sp.company) && <input type="hidden" name="company" value={one(sp.company)} />}
      {one(sp.period) && <input type="hidden" name="period" value={one(sp.period)} />}
      <AutoSubmit className="contents">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Category
          <select name="category" defaultValue={f.category ?? ""} className={field}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Product
          <select name="product" defaultValue={f.product ?? ""} className={field}>
            <option value="">All products</option>
            {opts.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Bin
          <select name="bin" defaultValue={f.bin ?? ""} className={field}>
            <option value="">All bins</option>
            {opts.bins.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          City
          <select name="city" defaultValue={f.city ?? ""} className={field}>
            <option value="">All cities</option>
            {opts.cities.map((c) => <option key={c} value={c}>{cityName(c)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          From (IST)
          <input type="date" name="from" defaultValue={f.from} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          To (IST)
          <input type="date" name="to" defaultValue={f.to} className={field} />
        </label>
      </AutoSubmit>
      <noscript><button type="submit">Apply</button></noscript>
    </Form>
  )

  return (
    <>
      <PageHeader eyebrow={`${scope.label} · ${period.label}`} title="Scans" desc="Every signed scan behind the totals. Filters live in the URL, so any view can be shared." />

      <div className="sticky top-16 z-20 -mx-4 mb-4 border-b neu-bar px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="hidden md:block">{filters}</div>
        <details className="md:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 font-semibold">
            <SlidersHorizontal className="size-4" /> Filters {filtered && <Badge kind="neutral">On</Badge>}
          </summary>
          <div className="pt-3">{filters}</div>
        </details>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <p className="tnum text-dim">{num(total)} scans</p>
        {filtered && <Link href={href("/app/scans", sp)} className="font-semibold text-dim underline-offset-4 hover:underline">Clear filters</Link>}
      </div>

      {rows.length === 0 ? (
        <EmptyState action={<Link href={href("/app/scans", sp)} className="font-semibold text-dim underline-offset-4 hover:underline">Clear filters</Link>}>No scans match these filters.</EmptyState>
      ) : (
        <div className="neu rounded-card p-4 sm:p-6">
          <DataTable<FeedRow>
            caption="Scans, newest first"
            rows={rows}
            rowKey={(r) => r.scan_id}
            rowHref={(r) => href(`/app/scans/${r.scan_id}`, sp)}
            title={(r) => r.product_name}
            cols={[
              { key: "time", label: "Time (IST)", cell: (r) => <span className="tnum whitespace-nowrap">{fmtDateTime(r.scanned_at).replace(" IST", "")}</span> },
              { key: "product", label: "Product", cell: (r) => r.product_name, hideMobile: true },
              { key: "cat", label: "Category", cell: (r) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CategorySwatch category={r.category} />{CATEGORY_LABEL[r.category]}</span> },
              { key: "bin", label: "Bin", cell: (r) => <span className="font-mono">{r.bin_id}</span> },
              { key: "city", label: "City", cell: (r) => cityName(r.city) },
              { key: "w", label: "Weight (g)", align: "right", cell: (r) => r.weight_g },
              { key: "tier", label: "Tier", cell: (r) => <TierBadge tier={r.tier} /> },
              { key: "ok", label: "Weight OK", cell: (r) => <WeightBadge ok={r.weight_ok} /> },
              { key: "flag", label: "Flag", cell: (r) => (r.flagged ? <Badge kind="flagged">✗ Flagged</Badge> : <span className="text-dim">—</span>) },
            ]}
          />
          <Pagination page={f.page} total={total} per={PAGE} hrefFor={pageHref} />
        </div>
      )}
    </>
  )
}
