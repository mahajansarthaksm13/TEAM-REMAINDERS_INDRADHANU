"use client"

import { useEffect, useState } from "react"
import { cityName } from "@/lib/shared"
import { fmtDateTime } from "@/lib/format"
import { HashChip } from "./client"

export type Sample = { scan_id: string; bin_id: string; scanned_at: string; record_text: string; signature: string; public_key: string; chain_hash: string }
type Result = "valid" | "invalid" | "unsupported"

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function verify(s: Sample): Promise<Result> {
  try {
    const key = await crypto.subtle.importKey("raw", b64(s.public_key), { name: "Ed25519" }, false, ["verify"])
    return (await crypto.subtle.verify("Ed25519", key, b64(s.signature), new TextEncoder().encode(s.record_text))) ? "valid" : "invalid"
  } catch (e) {
    return e instanceof DOMException && e.name === "NotSupportedError" ? "unsupported" : "invalid"
  }
}

// A15: every sample's Ed25519 signature is re-checked here, on the visitor's device.
export function SampleSignatures({ samples }: { samples: Sample[] }) {
  const [results, setResults] = useState<Record<string, Result>>({})
  useEffect(() => {
    let alive = true
    Promise.all(samples.map(async (s) => [s.scan_id, await verify(s)] as const)).then((r) => {
      if (alive) setResults(Object.fromEntries(r))
    })
    return () => {
      alive = false
    }
  }, [samples])

  const done = Object.keys(results).length === samples.length
  const valid = Object.values(results).filter((r) => r === "valid").length
  const unsupported = Object.values(results).some((r) => r === "unsupported")

  return (
    <>
      <p role="status" aria-live="polite" className="mb-4 text-sm font-semibold">
        {!done ? (
          <span className="text-dim">Checking signatures in your browser…</span>
        ) : unsupported ? (
          <span className="text-ink">⚠ Your browser can&apos;t run Ed25519 verification. Try a current Chrome, Edge, Firefox or Safari.</span>
        ) : valid === samples.length ? (
          <span className="text-success">✓ All {valid} signatures valid — verified in your browser.</span>
        ) : (
          <span className="text-ink">✗ {samples.length - valid} of {samples.length} signatures do not match their records.</span>
        )}
      </p>
      <ul className="divide-y divide-line">
        {samples.map((s) => {
          const r = results[s.scan_id]
          return (
            <li key={s.scan_id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <span className={!r ? "text-dim" : r === "valid" ? "text-success" : "text-ink"} aria-label={r ?? "checking"}>
                  {!r ? "…" : r === "valid" ? "✓" : "✗"}
                </span>
                <span className="font-mono">{s.bin_id} #{s.record_text.split("|")[2]}</span>
                <span className="text-dim">{cityName(s.bin_id.split("-")[1])} · {fmtDateTime(s.scanned_at)}</span>
              </span>
              <HashChip value={s.chain_hash} label="Chain hash" />
            </li>
          )
        })}
      </ul>
    </>
  )
}
