"use client"

import { useState, type ReactNode } from "react"
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { truncHash } from "@/lib/format"
import { Button } from "@/components/ui/button"

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={`${label} to clipboard`}
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-dim hover:bg-panel-hi focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setDone(true)
          toast("Copied")
          setTimeout(() => setDone(false), 1200)
        } catch {
          toast.error("Couldn't copy")
        }
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  )
}

// Mono chip: truncated in lists, full on proof pages (wraps, never scrolls the page).
export function HashChip({ value, full, label }: { value: string; full?: boolean; label?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 align-middle", full && "w-full")}>
      <code
        title={value}
        className={cn(
          "rounded-badge bg-chip px-2 py-0.5 font-mono text-xs text-ink sm:text-[13px]",
          full ? "min-w-0 flex-1 leading-5 [overflow-wrap:anywhere]" : "whitespace-nowrap"
        )}
      >
        {full ? value : truncHash(value)}
      </code>
      <CopyButton value={value} label={label ?? "Copy"} />
    </span>
  )
}

export function ProofField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow mb-1 text-dim">{label}</p>
      <HashChip value={value} full label={label} />
    </div>
  )
}

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

type VState = "idle" | "running" | "valid" | "invalid" | "unsupported"

// Frontend Spec B12 — runs entirely in the visitor's browser, no server call.
export function VerifySignature({ recordText, signature, publicKey }: { recordText: string; signature: string; publicKey: string }) {
  const [state, setState] = useState<VState>("idle")
  async function run() {
    setState("running")
    try {
      const key = await crypto.subtle.importKey("raw", b64(publicKey), { name: "Ed25519" }, false, ["verify"])
      const ok = await crypto.subtle.verify("Ed25519", key, b64(signature), new TextEncoder().encode(recordText))
      setState(ok ? "valid" : "invalid")
    } catch (e) {
      setState(e instanceof DOMException && e.name === "NotSupportedError" ? "unsupported" : "invalid")
    }
  }
  const msg: Partial<Record<VState, ReactNode>> = {
    valid: <span className="text-success">✓ Signature valid — verified in your browser.</span>,
    invalid: <span className="text-error">✗ Signature does not match this record.</span>,
    unsupported: <span className="text-warning">⚠ Your browser can&apos;t run Ed25519 verification. Try a current Chrome, Edge, Firefox or Safari.</span>,
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button onClick={run} disabled={state === "running"} size="lg">
        {state === "running" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Verify in browser
      </Button>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {msg[state]}
      </p>
    </div>
  )
}

// Submits its <form> on every change — URL-driven filters with no extra state.
export function AutoSubmit({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={className} onChange={(e) => (e.target as HTMLInputElement).form?.requestSubmit()}>
      {children}
    </div>
  )
}
