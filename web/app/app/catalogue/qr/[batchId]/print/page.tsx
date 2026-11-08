import type { Metadata } from "next"
import QRCode from "qrcode"
import { EmptyState, PageHeader } from "@/components/vb/ui"
import { PrintButton } from "./print-button"
import { batchCodes } from "@/lib/data"
import { UUID_RE } from "@/lib/shared"
import { requireSession } from "@/lib/session"
import { num } from "@/lib/format"

export const metadata: Metadata = { title: "QR sheet" }

const MAX = 200 // ponytail: sheet renders first 200 codes; full batch is in the CSV for the label printer.

export default async function PrintPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { sb } = await requireSession()
  const { batchId } = await params
  const b = UUID_RE.test(batchId) ? await batchCodes(sb, batchId, MAX) : null
  if (!b) return <><PageHeader title="QR sheet" /><EmptyState>Batch not found.</EmptyState></>
  const product = b.product
  // The QR encodes the full payload VBQ1.<product_code>.<serial>, which the bin scanner reads.
  const codes = await Promise.all(b.payloads.map(async (s) => ({ s, svg: await QRCode.toString(s, { type: "svg", margin: 0, errorCorrectionLevel: "M" }) })))
  return (
    <>
      <div className="no-print">
        <PageHeader
          eyebrow="QR sheet"
          title={product?.name ?? "Batch"}
          desc={b.quantity > MAX ? `Showing the first ${MAX} of ${num(b.quantity)} codes. Use the CSV for the full batch.` : `${num(b.quantity)} codes.`}
          actions={<PrintButton />}
        />
      </div>
      <ul className="grid grid-cols-3 gap-3 rounded-card bg-panel p-4 sm:grid-cols-5 lg:grid-cols-8 print:grid-cols-6 print:rounded-none print:p-0">
        {codes.map(({ s, svg }) => (
          <li key={s} className="flex flex-col items-center gap-1 rounded-[10px] border border-line p-2 break-inside-avoid">
            <div className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <span className="w-full truncate text-center font-mono text-[9px]" title={s}>{s.slice(0, 11)}…{s.slice(-4)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
