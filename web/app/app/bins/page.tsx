import Form from "next/form"
import type { Metadata } from "next"
import { AutoSubmit } from "@/components/vb/client"
import { DataTable, EmptyState, PageHeader, ScoreText, StatusBadge } from "@/components/vb/ui"
import { binList, type BinRow } from "@/lib/data"
import { cityName } from "@/lib/shared"
import { href, one, pageCtx } from "@/lib/session"
import { fmtDateTime, num, timeAgo } from "@/lib/format"

export const metadata: Metadata = { title: "Bins" }

const field = "h-10 skeu-inset rounded-input text-ink px-3 text-sm focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none"

export default async function BinsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, scope, sp } = await pageCtx(searchParams)
  const city = one(sp.city)
  const status = one(sp.status)
  const all = await binList(sb, scope.companyId)
  const rows = all.filter((b) => (!city || b.city === city) && (!status || b.status === status))
  const cities = [...new Set(all.map((b) => b.city))]
  return (
    <>
      <PageHeader title="Bins" desc="Every bin signs with its own key. Trust scores appear after the nightly analysis has 20+ scans for a bin." />
      <Form action="/app/bins" className="mb-4">
        {one(sp.company) && <input type="hidden" name="company" value={one(sp.company)} />}
        {one(sp.period) && <input type="hidden" name="period" value={one(sp.period)} />}
        <AutoSubmit className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            City
            <select name="city" defaultValue={city ?? ""} className={field}>
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{cityName(c)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Status
            <select name="status" defaultValue={status ?? ""} className={field}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
          </label>
        </AutoSubmit>
      </Form>
      {rows.length === 0 ? (
        <EmptyState>No bins registered.</EmptyState>
      ) : (
        <div className="skeu-raised rounded-card p-4 sm:p-6">
          <DataTable<BinRow>
            caption="Bins"
            rows={rows}
            rowKey={(r) => r.bin_id}
            rowHref={(r) => href(`/app/bins/${r.bin_id}`, sp)}
            title={(r) => <span className="font-mono">{r.bin_id}</span>}
            cols={[
              { key: "id", label: "Bin ID", cell: (r) => <span className="font-mono font-semibold">{r.bin_id}</span>, hideMobile: true },
              { key: "city", label: "City", cell: (r) => cityName(r.city) },
              { key: "status", label: "Status", cell: (r) => <StatusBadge status={r.status} quiet={r.quiet} /> },
              { key: "seen", label: "Last seen (IST)", cell: (r) => (r.last_seen ? <span title={fmtDateTime(r.last_seen)}>{timeAgo(r.last_seen)}</span> : "Never reported") },
              { key: "score", label: "Trust score", align: "right", cell: (r) => <ScoreText score={r.trust_score} /> },
              { key: "alerts", label: "Open alerts", align: "right", cell: (r) => (r.open_alerts ? <span className="font-semibold text-warning">{num(r.open_alerts)}</span> : "0") },
            ]}
          />
        </div>
      )}
    </>
  )
}
