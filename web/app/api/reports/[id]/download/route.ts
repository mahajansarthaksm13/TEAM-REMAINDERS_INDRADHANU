import { NextResponse, type NextRequest } from "next/server"
import { istEndExclusive, istStart, type Sb } from "@/lib/data"
import { getSession } from "@/lib/session"
import { renderPdf, storePdf, type ReportRow } from "@/lib/report-pdf"
import { UUID_RE } from "@/lib/shared"

// PDF: 302 to a short-lived signed Storage URL (Spec B7/B8). CSV: the scans behind the report.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await getSession()
  if (!s?.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 })
  if (!UUID_RE.test(id)) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
  const { data } = await s.sb.from("reports").select("*").eq("id", id).maybeSingle()
  if (!data) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
  const r = data as unknown as ReportRow
  const company = s.companies.find((c) => c.id === r.company_id)?.name ?? "Company"

  if (req.nextUrl.searchParams.get("format") === "csv") return csv(s.sb, r)

  let path = r.storage_path
  if (!path) {
    if (s.user.role !== "company") {
      // Only the owning company may attach the PDF; others get it rendered on the fly.
      const bytes = await renderPdf(r, company, req.nextUrl.origin)
      return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.id}.pdf"` } })
    }
    path = (await storePdf(s.sb, r, company, req.nextUrl.origin)).path
  }
  const { data: signed, error } = await s.sb.storage.from("reports").createSignedUrl(path, 300)
  if (error || !signed) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
  return NextResponse.redirect(signed.signedUrl, 302)
}

// ponytail: mirrors public._report_scan_ids (same company, category, IST period, received before the end of the
// checkpoint day, weight_ok not false, no demo bins). If that rule changes, change this too.
async function csv(sb: Sb, r: ReportRow) {
  const rows: string[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb
      .from("scans")
      .select("id, bin_id, sequence, scanned_at, received_at, code_type, code, weight_g, weight_ok, chain_hash, insertion_order, bins!inner(is_demo), scan_flags(reason)")
      .eq("company_id", r.company_id)
      .eq("category", r.category)
      .eq("bins.is_demo", false)
      .not("weight_ok", "is", false)
      .gte("scanned_at", istStart(r.period_start))
      .lt("scanned_at", istEndExclusive(r.period_end))
      .order("insertion_order")
      .range(from, from + 999)
    if (r.checkpoint_day) q = q.lt("received_at", istEndExclusive(r.checkpoint_day))
    const { data, error } = await q
    if (error) return NextResponse.json({ code: "FAILED" }, { status: 500 })
    for (const s of data ?? []) {
      const flags = (s.scan_flags as { reason: string }[] | null)?.map((f) => f.reason).join(";") ?? ""
      rows.push([s.id, s.bin_id, s.sequence, s.scanned_at, s.code_type, s.code, s.weight_g, flags, s.chain_hash].join(","))
    }
    if (!data || data.length < 1000) break
  }
  const head = "scan_id,bin_id,sequence,scanned_at,code_type,code,weight_g,flags,chain_hash"
  return new NextResponse([head, ...rows].join("\n") + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="report-${r.id}.csv"` } })
}
