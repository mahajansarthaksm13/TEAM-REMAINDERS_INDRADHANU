import { NextResponse } from "next/server"
import { batchCodes } from "@/lib/data"
import { getSession } from "@/lib/session"
import { UUID_RE } from "@/lib/shared"

// One row per code; qr_payload is exactly what is printed as the QR (A11).
export async function GET(_: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const s = await getSession()
  if (!s?.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 })
  const b = UUID_RE.test(batchId) ? await batchCodes(s.sb, batchId) : null
  if (!b) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
  const name = b.product.name.replaceAll('"', '""')
  const csv = ["qr_payload,product_code,product,issued_at", ...b.payloads.map((p) => `${p},${b.product.product_code},"${name}",${b.created_at}`)].join("\n") + "\n"
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="qr-batch-${b.id}.csv"` } })
}
