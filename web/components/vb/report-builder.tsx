"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2 } from "lucide-react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { previewReport } from "@/lib/actions"
import { CATEGORIES, CATEGORY_DESC, CATEGORY_LABEL } from "@/lib/shared"
import { periodOptions } from "@/lib/period"
import { forSelection, selectionKey } from "@/lib/ui-state"
import { fmtDay, kg, num } from "@/lib/format"
import { HashChip, ProofField } from "./client"
import { Card, CardHead, Notice } from "./ui"

type Snap = { qr_kg: number; barcode_kg: number; scan_count: number; under_review_count: number; checkpoint_day: string; checkpoint_hash: string; fingerprint: string }
type Generated = { report_id: string; verify_url: string; fingerprint: string; pdf_url: string; csv_url: string; pdf_stored: boolean }

const field = "h-10 w-full neu-inset rounded-input text-ink px-3 text-sm focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none"

export function ReportBuilder({ fy, defaultPeriod }: { fy: number; defaultPeriod: string }) {
  const router = useRouter()
  const opts = periodOptions(fy)
  const [category, setCategory] = useState("cat1_rigid")
  const [period, setPeriod] = useState(defaultPeriod)
  // A preview is tagged with the category + period it was asked for; it only shows (and only feeds
  // Generate) while that is still the selection, so a slow response can't mislabel a report.
  const [result, setResult] = useState<{ key: string; snapshot: Snap | null; note: string; range: { from: string; to: string } | null }>()
  const current = forSelection(result, selectionKey(category, period))
  const snap = current ? current.snapshot : undefined
  const note = current?.note ?? ""
  const range = current?.range ?? null
  const [gen, setGen] = useState<Generated | null>(null)
  const [qr, setQr] = useState("")
  const [err, setErr] = useState("")
  const [previewing, startPreview] = useTransition()
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (gen) QRCode.toDataURL(gen.verify_url, { margin: 1, width: 240, color: { dark: "#171123", light: "#FBFBFB" } }).then(setQr)
  }, [gen])

  function reset() {
    setGen(null)
    setQr("") // never show the previous report's QR next to a new one
    setErr("")
  }

  function preview() {
    const key = selectionKey(category, period)
    startPreview(async () => {
      const r = await previewReport(category, period)
      if ("error" in r && r.error) return setErr(r.error)
      setResult({ key, snapshot: r.snapshot ?? null, note: ("note" in r && r.note) || "", range: r.period ? { from: r.period.from, to: r.period.to } : null })
    })
  }

  async function generate() {
    if (!range) return
    setGenerating(true)
    setErr("")
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, ...range }) })
      if (res.status === 401) return router.push("/login?next=/app/reports")
      if (res.status === 422) return setErr("No checkpointed scans in this period. Nothing was saved.")
      if (!res.ok) throw new Error()
      setGen(await res.json())
      toast.success("Report generated.")
      router.refresh()
    } catch {
      setErr("Report couldn't be generated. Nothing was saved.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4">
        <CardHead eyebrow="Generate" title="Collection Evidence Report" />
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            EPR category
            <select className={field} value={category} onChange={(e) => (setCategory(e.target.value), reset())}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]} · {CATEGORY_DESC[c]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Period
            <select className={field} value={period} onChange={(e) => (setPeriod(e.target.value), reset())}>
              <optgroup label="Year">{opts.year.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</optgroup>
              <optgroup label="Quarter">{opts.quarter.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</optgroup>
              <optgroup label="Month">{opts.month.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</optgroup>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" onClick={preview} disabled={previewing || generating}>
              {previewing && <Loader2 className="animate-spin" />}Preview
            </Button>
            <Button onClick={generate} disabled={!snap || generating || !!gen}>
              {generating && <Loader2 className="animate-spin" />}Generate report
            </Button>
          </div>
          {err && <Notice kind="error">{err}</Notice>}
        </div>
      </Card>

      <Card className="lg:col-span-8">
        {snap === undefined ? (
          <div className="flex h-full min-h-48 items-center justify-center text-center text-sm text-dim">Pick a category and period, then Preview to see the snapshot.</div>
        ) : snap === null ? (
          <Notice>{note || "No checkpointed scans in this period. Scans become reportable after the nightly checkpoint."}</Notice>
        ) : (
          <div>
            <CardHead eyebrow="Snapshot preview" title={`Up to checkpoint ${fmtDay(snap.checkpoint_day)}`} />
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["QR tier", kg(snap.qr_kg)],
                ["Barcode tier", kg(snap.barcode_kg)],
                ["Scans included", num(snap.scan_count)],
                ["Under review", num(snap.under_review_count)],
              ].map(([k, v]) => (
                <div key={k} className="neu-inset rounded-[14px] p-4">
                  <dt className="eyebrow text-dim">{k}</dt>
                  <dd className="t-kpi mt-1 text-2xl lg:text-[28px]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-dim">Checkpoint hash <HashChip value={snap.checkpoint_hash} label="Checkpoint hash" /></p>
            <p className="mt-2 text-xs text-dim">Totals use catalogue weights. Weight-mismatch scans are left out; AI-flagged scans stay in and are counted as under review.</p>

            {gen && (
              <div className="mt-6 grid gap-6 border-t border-line pt-6 sm:grid-cols-[160px_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data: URL */}
                {qr ? <img src={qr} alt={`QR code linking to ${gen.verify_url}`} className="size-40 rounded-[10px] border border-line" /> : <div className="size-40 rounded-[10px] bg-chip" />}
                <div className="flex min-w-0 flex-col gap-4">
                  <p className="font-mono text-sm font-semibold [overflow-wrap:anywhere]">{gen.report_id}</p>
                  <ProofField label="Fingerprint" value={gen.fingerprint} />
                  <div className="flex flex-wrap gap-2">
                    <Button asChild><a href={gen.pdf_url} target="_blank" rel="noreferrer"><Download />Download PDF</a></Button>
                    <Button asChild variant="secondary"><a href={gen.csv_url}><Download />Download CSV</a></Button>
                    <Button asChild variant="ghost"><a href={gen.verify_url} target="_blank" rel="noreferrer">Open verify page ↗</a></Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
