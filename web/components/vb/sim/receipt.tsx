"use client"

// The evidence for one counted deposit: the exact text the bin signed, its Ed25519 signature
// and its place in the bin's hash chain. Anyone can check it here, in their own browser.
// "Tamper with it" changes one character of the record in this browser only (never the
// database) to show why an edit cannot go unnoticed.
import { useEffect, useState } from "react"
import { cn } from "cn"
import { ProofField, VerifySignature } from "@/components/vb/client"
import { Badge } from "@/components/vb/ui"

export type Receipt = {
  scan_id: string
  record: string
  signature: string
  record_hash: string
  prev_hash: string
  chain_hash: string
  public_key: string
  sequence?: number | null
  weight_ok?: boolean | null
  status: "approved" | "review"
}

const hex = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

// Change the weight field (last "|" part) by one digit: the smallest believable edit.
export function tamper(record: string) {
  const parts = record.split("|")
  const w = Number(parts[parts.length - 1])
  parts[parts.length - 1] = String(Number.isFinite(w) ? w + 1 : 0)
  return parts.join("|")
}

export function EvidenceReceipt({ r }: { r: Receipt }) {
  const [tampered, setTampered] = useState(false)
  const text = tampered ? tamper(r.record) : r.record
  const [chain, setChain] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    hex(text).then(async (h) => {
      const c = await hex(`${r.prev_hash}:${h}`)
      if (live) setChain(c)
    })
    return () => {
      live = false
    }
  }, [text, r.prev_hash])

  const chainOk = chain === r.chain_hash
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind={r.status === "approved" ? "approved" : "flagged"}>{r.status === "approved" ? "✓ Counted" : "⚠ Under review, not counted"}</Badge>
        {r.sequence != null && <Badge kind="neutral">Record #{r.sequence} on this bin</Badge>}
        <Badge kind="neutral">Scan {r.scan_id.slice(0, 8)}</Badge>
      </div>

      <div className={cn("rounded-[14px] p-1 transition-colors", tampered && "bg-orchid/20")}>
        <ProofField label={tampered ? "Signed text (edited in your browser)" : "Signed text, exactly as the bin signed it"} value={text} />
      </div>
      <ProofField label="Ed25519 signature" value={r.signature} />
      <div className="grid gap-4 md:grid-cols-2">
        <ProofField label="Previous chain hash" value={r.prev_hash} />
        <ProofField label="Chain hash stored in the ledger" value={r.chain_hash} />
      </div>

      <div className="neu-inset grid gap-3 rounded-[14px] p-4">
        <VerifySignature key={text} recordText={text} signature={r.signature} publicKey={r.public_key} />
        <p className="text-sm font-semibold" role="status" aria-live="polite">
          {chain == null ? "Recomputing the chain hash…" : chainOk ? "✓ Chain hash recomputed in your browser matches the ledger." : "✗ Recomputed chain hash no longer matches the ledger. The edit is detected."}
        </p>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={tampered} onChange={(e) => setTampered(e.target.checked)} className="size-4 accent-[var(--violet)]" />
          <span>
            <b>Tamper with it:</b> add 1 g to the weight in this copy, then verify again. Only this page changes, never the ledger.
          </span>
        </label>
      </div>
    </div>
  )
}
