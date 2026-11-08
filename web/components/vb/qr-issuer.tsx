"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { issueQr } from "@/lib/actions"
import { FieldError, Notice } from "./ui"
import { HashChip } from "./client"

const select = "h-10 w-full skeu-inset rounded-input text-ink px-3 text-sm focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none"
const QUANTITY_RANGE = "Quantity must be a whole number from 1 to 10,000."

export function QrIssuer({ products, printBase }: { products: { id: string; name: string }[]; printBase: string }) {
  const router = useRouter()
  const [product, setProduct] = useState(products[0]?.id ?? "")
  const [qty, setQty] = useState("100")
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState("")
  const [batch, setBatch] = useState<{ batch_id: string; count: number } | null>(null)
  const n = Number(qty)
  const qtyErr = !/^\d+$/.test(qty) || n < 1 || n > 10000 ? QUANTITY_RANGE : ""

  async function issue() {
    setPending(true)
    setErr("")
    try {
      const r = await issueQr(product, n)
      if ("error" in r && r.error) return setErr(r.error)
      setBatch(r as { batch_id: string; count: number })
      toast.success(`${n.toLocaleString("en-IN")} codes issued.`)
      router.refresh()
    } catch {
      setErr("Couldn't reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qr-product">Approved product</Label>
          <select id="qr-product" className={select} value={product} onChange={(e) => setProduct(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qr-qty">Quantity</Label>
          <Input id="qr-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.trim())} aria-invalid={!!qtyErr || undefined} aria-describedby={qtyErr ? "qty-err" : undefined} />
        </div>
      </div>
      {qtyErr && <FieldError id="qty-err">{qtyErr}</FieldError>}
      <div>
        <Button onClick={issue} disabled={pending || !!qtyErr || !product}>{pending && <Loader2 className="animate-spin" />}Issue codes</Button>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      {batch && (
        <div className="rounded-[14px] bg-deep/60 p-4">
          <p className="eyebrow text-dim">Batch created</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">Batch <HashChip value={batch.batch_id} label="Batch ID" /> · <strong className="tnum">{batch.count.toLocaleString("en-IN")}</strong> codes</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="secondary"><a href={`/api/qr/${batch.batch_id}/csv`}><Download />Download CSV</a></Button>
            <Button asChild variant="secondary"><Link href={`${printBase}/${batch.batch_id}/print`}><Printer />Open printable sheet</Link></Button>
          </div>
        </div>
      )}
    </div>
  )
}
