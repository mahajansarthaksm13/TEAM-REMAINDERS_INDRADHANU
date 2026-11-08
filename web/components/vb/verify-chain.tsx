"use client"

import Link from "next/link"
import { useState } from "react"
import { Link2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { runVerifyChain } from "@/lib/actions"

// verify_chain(p_bin_id) -> ok, scans_checked, failing_scan, reason (D15)
type ChainResult = { ok: boolean; scans_checked: number; failing_scan: string | null; reason: string | null }
const REASON: Record<string, string> = {
  record_hash_mismatch: "the record hash does not match the signed text",
  columns_differ_from_signed_text: "a stored field differs from what the bin signed",
  prev_hash_mismatch: "the link to the previous record is broken",
  chain_hash_mismatch: "the chain hash does not recompute",
  chain_head_mismatch: "the bin's chain head does not match its last record (a record may be missing)",
  unknown_bin: "this bin is not visible to you",
}

type S = { kind: "idle" } | { kind: "running" } | { kind: "done"; r: ChainResult } | { kind: "error" }

export function VerifyChain({ binId, scanHref }: { binId: string; scanHref: string }) {
  const [s, setS] = useState<S>({ kind: "idle" })
  async function run() {
    setS({ kind: "running" })
    try {
      const res = await runVerifyChain(binId)
      setS("result" in res && res.result ? { kind: "done", r: res.result } : { kind: "error" })
    } catch {
      setS({ kind: "error" })
    }
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button size="lg" onClick={run} disabled={s.kind === "running"}>
        {s.kind === "running" ? <Loader2 className="animate-spin" /> : <Link2 />}Verify chain
      </Button>
      <div role="status" aria-live="polite" className="text-sm font-semibold">
        {s.kind === "running" && <span className="text-dim">Walking the chain…</span>}
        {s.kind === "error" && (
          <span className="text-error">
            Verification couldn&apos;t run. <button className="underline" onClick={run}>Retry</button>
          </span>
        )}
        {s.kind === "done" && s.r.ok && <span className="text-success">✓ Chain intact — all {Number(s.r.scans_checked).toLocaleString("en-IN")} records verified.</span>}
        {s.kind === "done" && !s.r.ok && (
          <span className="text-error">
            ✗ Chain break at record {Number(s.r.scans_checked).toLocaleString("en-IN")}: {REASON[s.r.reason ?? ""] ?? s.r.reason}.{" "}
            {s.r.failing_scan && <Link href={`/app/scans/${s.r.failing_scan}${scanHref}`} className="underline underline-offset-4">Open that scan →</Link>}
          </span>
        )}
      </div>
    </div>
  )
}
