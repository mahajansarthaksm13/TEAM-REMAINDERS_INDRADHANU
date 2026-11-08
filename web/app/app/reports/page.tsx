import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, CategorySwatch, DataTable, EmptyState, PageHeader } from "@/components/vb/ui"
import { HashChip } from "@/components/vb/client"
import { ReportBuilder } from "@/components/vb/report-builder"
import type { ReportRow } from "@/lib/report-pdf"
import { pageCtx } from "@/lib/session"
import { CATEGORY_LABEL } from "@/lib/shared"
import { fmtDateTime, fmtDay } from "@/lib/format"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, user, companies, scope, period } = await pageCtx(searchParams)
  let q = sb.from("reports").select("*").order("created_at", { ascending: false }).limit(100)
  if (scope.companyId) q = q.eq("company_id", scope.companyId)
  const history = ((await q).data ?? []) as unknown as ReportRow[]
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "—"
  const isCompany = user.role === "company"
  const link = "font-semibold text-olive-700 underline-offset-4 hover:underline"
  return (
    <>
      <PageHeader
        eyebrow={`${scope.label} · ${period.label}`}
        title="Reports"
        desc="Built only from checkpointed scans. Each report carries a QR code anyone can use to rebuild it from the ledger."
      />
      {isCompany && <ReportBuilder fy={period.fy} defaultPeriod={period.key} />}

      <Card className={isCompany ? "mt-6" : ""}>
        <CardHead eyebrow="History" title={isCompany ? "Generated reports" : "Reports (read-only)"} />
        {history.length === 0 ? (
          <EmptyState>No reports yet.</EmptyState>
        ) : (
          <DataTable<ReportRow>
            caption="Report history"
            rows={history}
            rowKey={(r) => r.id}
            title={(r) => <span className="font-mono">{r.id.slice(0, 8)}</span>}
            cols={[
              { key: "id", label: "ID", cell: (r) => <span className="font-mono font-semibold whitespace-nowrap" title={r.id}>{r.id.slice(0, 8)}</span>, hideMobile: true },
              ...(scope.current === "all" ? [{ key: "co", label: "Company", cell: (r: ReportRow) => companyName(r.company_id) }] : []),
              { key: "cat", label: "Category", cell: (r) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CategorySwatch category={r.category} />{CATEGORY_LABEL[r.category]}</span> },
              { key: "period", label: "Period", cell: (r) => <span className="whitespace-nowrap">{fmtDay(r.period_start)} – {fmtDay(r.period_end)}</span> },
              { key: "at", label: "Generated", cell: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.created_at)}</span> },
              { key: "fp", label: "Fingerprint", cell: (r) => <HashChip value={r.fingerprint} label="Fingerprint" /> },
              {
                key: "dl",
                label: "Files",
                cell: (r) => (
                  <span className="flex gap-3 whitespace-nowrap">
                    <a className={link} href={`/api/reports/${r.id}/download?format=pdf`} target="_blank" rel="noreferrer">PDF</a>
                    <a className={link} href={`/api/reports/${r.id}/download?format=csv`}>CSV</a>
                  </span>
                ),
              },
              { key: "v", label: "Verify", cell: (r) => <Link className={link} href={`/verify/${r.id}`}>Verify ↗</Link> },
            ]}
          />
        )}
      </Card>
    </>
  )
}
