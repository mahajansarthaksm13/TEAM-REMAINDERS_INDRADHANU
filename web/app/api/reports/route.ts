import { NextResponse, type NextRequest } from "next/server"
import { getSession } from "@/lib/session"
import { storePdf, type ReportRow } from "@/lib/report-pdf"
import { isCategory } from "@/lib/shared"

const DATE = /^\d{4}-\d{2}-\d{2}$/

// A14: create_report (the database computes the fingerprint) -> PDF -> upload -> attach.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s?.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 })
  if (s.user.role !== "company") return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 })
  const b = await req.json().catch(() => null)
  if (!b || !isCategory(b.category) || !DATE.test(b.from) || !DATE.test(b.to) || b.from > b.to)
    return NextResponse.json({ code: "INVALID" }, { status: 422 })

  const { data, error } = await s.sb.rpc("create_report", { p_category: b.category, p_from: b.from, p_to: b.to })
  if (error) {
    const empty = error.message.includes("no checkpointed scans") || error.message.includes("no checkpoint")
    return NextResponse.json({ code: empty ? "EMPTY_SNAPSHOT" : "FAILED" }, { status: empty ? 422 : 500 })
  }
  const r = data as unknown as ReportRow
  const origin = req.nextUrl.origin
  const company = s.companies.find((c) => c.id === r.company_id)?.name ?? "Company"
  let pdfStored = true
  try {
    await storePdf(s.sb, r, company, origin)
  } catch (e) {
    // The report row exists; the download route builds and attaches the PDF on first use.
    console.error("report pdf", e)
    pdfStored = false
  }
  return NextResponse.json(
    {
      report_id: r.id,
      verify_url: `${origin}/verify/${r.id}`,
      fingerprint: r.fingerprint,
      checkpoint_day: r.checkpoint_day,
      pdf_url: `/api/reports/${r.id}/download?format=pdf`,
      csv_url: `/api/reports/${r.id}/download?format=csv`,
      pdf_stored: pdfStored,
    },
    { status: 201 }
  )
}
