import Link from "next/link"
import type { Metadata } from "next"
import QRCode from "qrcode"
import { PublicIntro, Section } from "@/components/vb/brand"
import { Button } from "@/components/ui/button"
import { SAMPLE_REPORT_ID } from "@/lib/shared"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage() {
  const qr = await QRCode.toString(SAMPLE_REPORT_ID ? `/verify/${SAMPLE_REPORT_ID}` : "/checkpoints", { type: "svg", margin: 0, color: { dark: "#171123", light: "#FBFBFB" } })
  return (
    <>
      <PublicIntro eyebrow="Reports" title="The Collection Evidence Report.">
        <p>One report per EPR category and period. It states what was collected, split by evidence tier, and carries a fingerprint of every scan behind it.</p>
      </PublicIntro>
      <Section className="grid gap-12 lg:grid-cols-12 lg:items-start">
        <div className="space-y-8 lg:col-span-6">
          {[
            ["Built only from checkpointed scans", "Scans become reportable after the nightly checkpoint, so a report can never include data that wasn't sealed in public first."],
            ["Two evidence tiers", "QR-coded packets (unique serial, one-time redemption) are reported separately from barcode scans. Totals use the catalogue weight of each product."],
            ["Nothing hidden", "Scans whose measured weight is out of tolerance are left out. AI-flagged scans stay in and are shown as an under-review count."],
            ["Verifiable by anyone", "The QR code opens a page that rebuilds the report from the ledger and compares fingerprints."],
          ].map(([h, p]) => (
            <div key={h}>
              <h2 className="t-h3">{h}</h2>
              <p className="mt-2 max-w-[56ch] text-dim">{p}</p>
            </div>
          ))}
          {SAMPLE_REPORT_ID && <Button asChild size="lg"><Link href={`/verify/${SAMPLE_REPORT_ID}`}>Verify sample report</Link></Button>}
        </div>
        <figure className="neu rounded-card p-6 shadow-pop lg:col-span-6 lg:p-8" aria-label="Sample report preview">
          <div className="flex items-start justify-between gap-6 border-b border-line pb-5">
            <div>
              <p className="eyebrow text-dim">Collection Evidence Report</p>
              <p className="t-h3 mt-2">Producer name</p>
              <p className="mt-1 text-sm text-dim">Category I · Rigid plastics · one quarter of a financial year</p>
            </div>
            <div className="size-20 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
          <dl className="grid grid-cols-2 gap-4 py-5 text-sm">
            {[["QR tier", "—"], ["Barcode tier", "—"], ["Signed scans", "—"], ["Under review", "—"]].map(([k, v]) => (
              <div key={k}>
                <dt className="eyebrow text-dim">{k}</dt>
                <dd className="t-kpi mt-1 text-2xl">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 border-t border-line pt-5 font-mono text-xs">
            <p><span className="font-sans text-dim">Fingerprint </span>sha256 · 64 hex characters</p>
            <p><span className="font-sans text-dim">Checkpoint </span>day + hash, published on GitHub</p>
          </div>
          <figcaption className="mt-5 text-xs text-dim">Open the sample to see real figures rebuilt from the ledger.</figcaption>
        </figure>
      </Section>
    </>
  )
}
