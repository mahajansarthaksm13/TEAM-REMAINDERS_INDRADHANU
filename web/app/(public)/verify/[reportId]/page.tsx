import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, EmptyState, KV, VerdictBanner } from "@/components/vb/ui"
import { ProofField } from "@/components/vb/client"
import { SampleSignatures, type Sample } from "@/components/vb/sample-signatures"
import { anonDb } from "@/lib/supabase"
import { CATEGORY_DESC, CATEGORY_LABEL, UUID_RE, checkpointUrl, isCategory } from "@/lib/shared"
import { fmtDay, kg, num } from "@/lib/format"

export const metadata: Metadata = { title: "Verify report" }

type Verify = {
  found: boolean
  match: boolean
  report_id: string
  company: string
  category: string
  period_start: string
  period_end: string
  stored_fingerprint: string
  recomputed_fingerprint: string
  checkpoint_day: string
  checkpoint_hash: string
  scan_count: number
  qr_kg: number
  barcode_kg: number
  under_review_count: number
  pdf_sha256: string | null
  samples: Sample[]
}

// A15: called with the anon key; ✓ only when the database says match: true.
export default async function VerifyReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params
  const id = decodeURIComponent(reportId)
  if (!UUID_RE.test(id)) return <Shell id={id}><NotFound /></Shell>
  const { data, error } = await anonDb().rpc("verify_report", { p_report_id: id })
  if (error) throw new Error("verify_report failed")
  const v = data as unknown as Verify
  if (!v?.found) return <Shell id={id}><NotFound /></Shell>
  const cat = isCategory(v.category) ? v.category : "cat1_rigid"

  return (
    <Shell id={id}>
      <div className="flex flex-col gap-6">
        {v.match ? (
          <VerdictBanner kind="success" title="Match — this report matches the ledger.">
            We rebuilt it from the signed scans up to its checkpoint and got the same fingerprint.
          </VerdictBanner>
        ) : (
          <VerdictBanner kind="error" title="Mismatch — this report does not match the ledger.">
            The scans behind this report differ from what the ledger holds now. Treat its totals as unverified.
          </VerdictBanner>
        )}

        <Card>
          <CardHead eyebrow="Report" title={v.company} />
          <KV
            items={[
              ["Category", `${CATEGORY_LABEL[cat]} · ${CATEGORY_DESC[cat]}`],
              ["Period", `${fmtDay(v.period_start)} – ${fmtDay(v.period_end)}`],
              ["Scans included", num(Number(v.scan_count))],
              ["QR tier", kg(Number(v.qr_kg))],
              ["Barcode tier", kg(Number(v.barcode_kg))],
              ["Under review", num(Number(v.under_review_count))],
            ]}
          />
          <p className="mt-4 text-xs text-olive-700">Figures recomputed now from the ledger. Totals use catalogue weights.</p>
        </Card>

        <Card>
          <CardHead eyebrow="Fingerprint" title="Stored vs recomputed" />
          <div className="grid gap-4">
            <ProofField label="Stored (printed on the report)" value={v.stored_fingerprint} />
            <ProofField label="Recomputed now from the ledger" value={v.recomputed_fingerprint} />
            {v.pdf_sha256 && <ProofField label="SHA-256 of the issued PDF" value={v.pdf_sha256} />}
          </div>
        </Card>

        <Card>
          <CardHead
            eyebrow="Checkpoint"
            title={fmtDay(v.checkpoint_day)}
            action={<a href={checkpointUrl(v.checkpoint_day)} target="_blank" rel="noreferrer" className="text-sm font-semibold whitespace-nowrap text-olive-700 underline-offset-4 hover:underline">View on GitHub ↗</a>}
          />
          <ProofField label="Checkpoint hash" value={v.checkpoint_hash} />
          <p className="mt-3 text-sm text-olive-700">Only scans that reached the ledger before the end of this day (IST) count toward the report.</p>
        </Card>

        <Card>
          <CardHead eyebrow="Spot check" title={`${v.samples.length} random scans`} />
          <SampleSignatures samples={v.samples} />
        </Card>
      </div>
    </Shell>
  )
}

function Shell({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[840px] px-4 py-10 sm:px-6 lg:py-16">
      <p className="eyebrow mb-2 text-olive-700">Report verification</p>
      <h1 className="mb-6 font-mono text-lg leading-7 [overflow-wrap:anywhere] lg:text-xl">{id}</h1>
      {children}
    </div>
  )
}

const NotFound = () => (
  <EmptyState action={<Link href="/" className="font-semibold text-olive-700 underline-offset-4 hover:underline">Go to home</Link>}>No report with this ID.</EmptyState>
)
