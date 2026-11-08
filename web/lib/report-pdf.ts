// A14: render the Collection Evidence Report PDF from the stored report row, upload it with
// the service role to reports/<company_id>/<report_id>.pdf, then attach_report_pdf as the user.
// The fingerprint is never computed here: it comes from create_report().
import { createHash } from "node:crypto"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import QRCode from "qrcode"
import type { Sb } from "./data"
import { serviceDb } from "./supabase"
import { CATEGORY_DESC, CATEGORY_LABEL, type Category } from "./shared"
import { fmtDateTime, fmtDay, kg, num } from "./format"

export type ReportRow = {
  id: string
  company_id: string
  category: Category
  period_start: string
  period_end: string
  fingerprint: string
  checkpoint_day: string | null
  checkpoint_hash: string | null
  scan_count: number | null
  qr_kg: number | null
  barcode_kg: number | null
  under_review_count: number | null
  storage_path: string | null
  pdf_sha256: string | null
  created_at: string
}

// The site palette, on paper: Night ink, Violet labels, Orchid rules, Snow page.
const OLIVE = rgb(0x17 / 255, 0x11 / 255, 0x23 / 255) // Night
const DEEP = rgb(0x6f / 255, 0x2d / 255, 0xbd / 255) // Violet
const MIST = rgb(0xa6 / 255, 0x63 / 255, 0xcc / 255) // Orchid
const SNOW = rgb(0xfb / 255, 0xfb / 255, 0xfb / 255)
const ascii = (t: string) => t.replace(/[^ -~]/g, " ") // standard PDF fonts are WinAnsi only

export const pdfPath = (r: Pick<ReportRow, "company_id" | "id">) => `${r.company_id}/${r.id}.pdf`

export async function renderPdf(r: ReportRow, companyName: string, origin: string) {
  const doc = await PDFDocument.create()
  const created = new Date(r.created_at)
  doc.setTitle(`Collection Evidence Report ${r.id}`)
  doc.setProducer("VeriBin")
  doc.setCreator("VeriBin")
  doc.setCreationDate(created)
  doc.setModificationDate(created)
  const page = doc.addPage([595, 842]) // A4
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const verifyUrl = `${origin}/verify/${r.id}`
  const qr = await doc.embedPng(await QRCode.toBuffer(verifyUrl, { margin: 1, width: 300, color: { dark: "#171123", light: "#FBFBFB" } }))

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: SNOW })
  page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: OLIVE })
  page.drawText("VeriBin", { x: 48, y: 792, size: 26, font: serif, color: SNOW })
  page.drawText("COLLECTION EVIDENCE REPORT", { x: 330, y: 798, size: 10, font: bold, color: MIST })
  page.drawText(r.id, { x: 330, y: 782, size: 7.5, font: mono, color: MIST })

  let y = 720
  const line = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: 48, y, size: 8, font: bold, color: DEEP })
    page.drawText(ascii(value), { x: 180, y, size: 11, font: sans, color: OLIVE })
    y -= 22
  }
  page.drawText(ascii(companyName), { x: 48, y, size: 20, font: serif, color: OLIVE })
  y -= 34
  line("Category", `${CATEGORY_LABEL[r.category]} - ${CATEGORY_DESC[r.category]}`)
  line("Period", `${fmtDay(r.period_start)} to ${fmtDay(r.period_end)}`)
  line("Generated", fmtDateTime(r.created_at))
  y -= 8
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: MIST })
  y -= 34
  const figs: [string, string][] = [
    ["QR tier", kg(Number(r.qr_kg ?? 0))],
    ["Barcode tier", kg(Number(r.barcode_kg ?? 0))],
    ["Scans included", num(Number(r.scan_count ?? 0))],
    ["Under review", num(Number(r.under_review_count ?? 0))],
  ]
  figs.forEach(([k, v], i) => {
    const x = 48 + i * 125
    page.drawText(k.toUpperCase(), { x, y: y + 18, size: 8, font: bold, color: DEEP })
    page.drawText(ascii(v), { x, y: y - 6, size: 18, font: bold, color: OLIVE })
  })
  y -= 50
  for (const t of [
    "Totals use catalogue weights. Scans whose measured weight was out of tolerance are excluded;",
    "AI-flagged scans stay in and are counted as under review.",
  ]) {
    page.drawText(t, { x: 48, y, size: 9.5, font: sans, color: DEEP })
    y -= 14
  }
  y -= 24
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1, color: MIST })
  y -= 30
  line("Checkpoint day", r.checkpoint_day ? fmtDay(r.checkpoint_day) : "-")
  page.drawText("CHECKPOINT HASH", { x: 48, y, size: 8, font: bold, color: DEEP })
  page.drawText(r.checkpoint_hash ?? "-", { x: 48, y: y - 14, size: 8.5, font: mono, color: OLIVE })
  y -= 42
  page.drawText("FINGERPRINT (SHA-256 OF THE INCLUDED CHAIN HASHES)", { x: 48, y, size: 8, font: bold, color: DEEP })
  page.drawText(r.fingerprint, { x: 48, y: y - 14, size: 8.5, font: mono, color: OLIVE })
  y -= 60

  page.drawImage(qr, { x: 48, y: y - 130, width: 130, height: 130 })
  const tx = 200
  page.drawText("Verify this report", { x: tx, y: y - 16, size: 14, font: bold, color: OLIVE })
  ;[
    "Scan the code. The page rebuilds this report from the signed",
    "scans up to the checkpoint above and compares fingerprints.",
    "A match means these figures are exactly what the ledger holds.",
  ].forEach((t, i) => page.drawText(t, { x: tx, y: y - 38 - i * 15, size: 10, font: sans, color: DEEP }))
  page.drawText(verifyUrl, { x: tx, y: y - 96, size: 7.5, font: mono, color: OLIVE })

  page.drawText("Evidence-backed supporting record for EPR filings. It does not replace CPCB-issued certificates. Times IST.", { x: 48, y: 40, size: 8, font: sans, color: DEEP })

  return doc.save({ useObjectStreams: false })
}

// Upload + attach once. Returns the storage path. Safe to call again: attach refuses a second PDF.
export async function storePdf(sb: Sb, r: ReportRow, companyName: string, origin: string) {
  const bytes = await renderPdf(r, companyName, origin)
  const sha = createHash("sha256").update(bytes).digest("hex")
  const path = pdfPath(r)
  const up = await serviceDb().storage.from("reports").upload(path, bytes, { contentType: "application/pdf", upsert: true })
  if (up.error) throw new Error(`upload: ${up.error.message}`)
  const { error } = await sb.rpc("attach_report_pdf", { p_report_id: r.id, p_storage_path: path, p_pdf_sha256: sha })
  if (error) throw new Error(`attach_report_pdf: ${error.message}`)
  return { path, sha }
}
