"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, RotateCcw, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { browserDb } from "@/lib/supabase-browser"
import { fmtTime } from "@/lib/format"
import { ProofField, VerifySignature } from "./client"

const STAGES = ["Signed", "Signature verified", "Chained", "Appeared in feed"]
// Ingest reason codes (CONTRACTS §6) -> the stage that refused the scan
const FAIL_STAGE: Record<string, number> = { bad_format: 1, unknown_bin: 1, bad_signature: 1, bin_inactive: 2, time_too_far_future: 2, time_too_old: 2, duplicate_sequence: 3, barcode_cooldown: 3, unknown_product: 3 }
const REASON: Record<string, string> = {
  barcode_cooldown: "The bin refuses the same barcode twice within 30 seconds. Wait a moment and try again.",
  duplicate_sequence: "Someone else scanned at the same instant. Try again.",
  demo_not_configured: "The demo bin's key is not configured on this server.",
  ingest_unreachable: "Couldn't reach the ingest service.",
}

type Result = { scan_id: string; record: string; signature: string; record_hash: string; prev_hash: string; chain_hash: string; public_key: string }
type FeedItem = { scan_id: string; received_at: string; weight_g: number }
type State =
  | { kind: "idle" }
  | { kind: "running"; done: number; res?: Result }
  | { kind: "success"; res: Result }
  | { kind: "rejected"; stage: number; reason: string }
  | { kind: "limited" }
  | { kind: "network" }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Simulator({ initialFeed }: { initialFeed: FeedItem[] }) {
  const [state, setState] = useState<State>({ kind: "idle" })
  const [feed, setFeed] = useState(initialFeed)
  const [fresh, setFresh] = useState<string | null>(null)
  const [feedLive, setFeedLive] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const reduce = useRef(false)

  useEffect(() => {
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // Private `demo` channel, readable with the publishable key (D9). Payload: scan_id, weight_g, scanned_at, ...
  useEffect(() => {
    const sb = browserDb()
    const ch = sb
      .channel("demo", { config: { private: true } })
      .on("broadcast", { event: "scan" }, ({ payload }) => {
        const item = { scan_id: String(payload.scan_id), received_at: new Date().toISOString(), weight_g: Number(payload.weight_g) }
        setFeed((cur) => [item, ...cur.filter((x) => x.scan_id !== item.scan_id)].slice(0, 8))
        setFresh(item.scan_id)
      })
      .subscribe((st) => setFeedLive(st === "SUBSCRIBED"))
    return () => {
      sb.removeChannel(ch)
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function scan() {
    setState({ kind: "running", done: 0 })
    let res: Response
    try {
      res = await fetch("/api/demo/scan", { method: "POST" })
    } catch {
      return setState({ kind: "network" })
    }
    if (res.status === 429) {
      setCooldown(60)
      return setState({ kind: "limited" })
    }
    const body = await res.json().catch(() => null)
    if (!res.ok || !body) {
      const reason = body?.reason ?? "rejected"
      const stage = FAIL_STAGE[reason] ?? 1
      for (let i = 1; i < stage; i++) {
        await wait(reduce.current ? 0 : 450)
        setState({ kind: "running", done: i })
      }
      return setState({ kind: "rejected", stage, reason })
    }
    const r = body as Result
    for (let i = 1; i <= 3; i++) {
      await wait(reduce.current ? 0 : 450)
      setState({ kind: "running", done: i, res: r })
    }
    await wait(reduce.current ? 0 : 450)
    // The broadcast usually arrives first; add it here too in case realtime is slow.
    setFeed((cur) => (cur.some((x) => x.scan_id === r.scan_id) ? cur : [{ scan_id: r.scan_id, received_at: new Date().toISOString(), weight_g: 24 }, ...cur].slice(0, 8)))
    setFresh(r.scan_id)
    setState({ kind: "success", res: r })
  }

  const done = state.kind === "running" ? state.done : state.kind === "success" ? 4 : state.kind === "rejected" ? state.stage : 0
  const failed = state.kind === "rejected" ? state.stage : -1
  const res = state.kind === "running" ? state.res : state.kind === "success" ? state.res : undefined
  const busy = state.kind === "running"

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="rounded-card border border-sage-200 bg-surface p-4 sm:p-6 lg:col-span-8">
        <p className="eyebrow mb-3 text-olive-700">1 · The packet</p>
        <div className="flex items-center gap-4 rounded-[14px] border border-olive-700 bg-sage-200 p-4 text-sm">
          <span className="font-semibold">Demo bottle</span>
          <span className="text-olive-700">Category I · 24 g · barcode 8900000099999 · bin VB-PUN-9999-DEMO</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {state.kind === "success" ? (
            <Button size="lg" onClick={() => setState({ kind: "idle" })}><RotateCcw />Scan another</Button>
          ) : state.kind === "network" ? (
            <Button size="lg" onClick={scan}><RotateCcw />Retry</Button>
          ) : (
            <Button size="lg" onClick={scan} disabled={busy || cooldown > 0}>
              {busy && <Loader2 className="animate-spin" />}Scan sample packet
            </Button>
          )}
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {(state.kind === "limited" || cooldown > 0) && <span className="text-warning">⚠ Demo limit reached — try again in a minute.{cooldown > 0 && ` (${cooldown}s)`}</span>}
            {state.kind === "network" && <span className="text-error">✗ Couldn&apos;t reach the server.</span>}
            {state.kind === "rejected" && <span className="text-error">✗ Ingest rejected: {state.reason}. {REASON[state.reason] ?? ""}</span>}
            {state.kind === "success" && <span className="text-success">✓ Stored, chained and in the feed.</span>}
          </p>
        </div>

        <p className="eyebrow mt-8 mb-4 text-olive-700">2 · Watch it travel</p>
        <ol className="grid grid-cols-4 gap-2" aria-label="Scan stages">
          {STAGES.map((s, i) => {
            const n = i + 1
            const isFail = n === failed
            const isDone = n <= done && !isFail
            const isActive = busy && n === done + 1
            return (
              <li key={s} className="relative flex flex-col items-center text-center">
                {i < 3 && <span aria-hidden className={cn("absolute top-3 left-[calc(50%+12px)] h-0.5 w-[calc(100%-24px)]", n < done ? "bg-olive-700" : "bg-sage-200")} />}
                <span
                  className={cn(
                    "relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-garden-50",
                    isFail ? "border-error bg-error" : isDone ? "border-olive-700 bg-olive-700" : isActive ? "soft-pulse border-olive-700 bg-surface" : "border-sage-200 bg-surface"
                  )}
                >
                  {isFail ? <X className="size-3.5" /> : isDone ? <Check className="size-3.5" /> : null}
                </span>
                <span className={cn("mt-2 text-xs font-semibold sm:text-sm", isFail && "text-error")}>
                  {s}
                  <span className="sr-only">{isFail ? " — failed" : isDone ? " — done" : isActive ? " — in progress" : " — pending"}</span>
                </span>
              </li>
            )
          })}
        </ol>

        {res && (
          <div className="mt-8 grid gap-4">
            {done >= 1 && <ProofField label="Signed text" value={res.record} />}
            {done >= 1 && <ProofField label="Signature (Ed25519, base64)" value={res.signature} />}
            {done >= 3 && (
              <div className="grid gap-4 md:grid-cols-3">
                <ProofField label="Record hash" value={res.record_hash} />
                <ProofField label="Previous hash" value={res.prev_hash} />
                <ProofField label="Chain hash" value={res.chain_hash} />
              </div>
            )}
            {state.kind === "success" && (
              <div className="rounded-[14px] bg-garden-50 p-4">
                <p className="mb-3 text-sm text-olive-700">Check the signature yourself, on your device, with the demo bin&apos;s public key.</p>
                <VerifySignature recordText={res.record} signature={res.signature} publicKey={res.public_key} />
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="rounded-card border border-sage-200 bg-surface p-4 sm:p-6 lg:col-span-4" aria-label="Demo feed">
        <div className="mb-4 flex items-center justify-between">
          <p className="eyebrow text-olive-700">Live demo feed</p>
          {feedLive ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-success"><span className="size-2 rounded-full bg-success" />Live</span>
          ) : (
            <span className="text-xs font-semibold text-warning">Live feed reconnecting…</span>
          )}
        </div>
        {feed.length === 0 ? (
          <p className="text-sm text-olive-700">No demo scans yet. Be the first.</p>
        ) : (
          <ul className="divide-y divide-sage-200" aria-live="polite">
            {feed.map((f) => (
              <li key={f.scan_id} className={cn("flex items-center justify-between gap-3 rounded-[10px] px-2 py-3 text-sm", f.scan_id === fresh && "feed-in")}>
                <span className="truncate">Demo bottle · {f.weight_g} g</span>
                <span className="tnum shrink-0 text-xs text-olive-700">{fmtTime(f.received_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-olive-700">Simulator scans use demo bin VB-PUN-9999-DEMO and never count toward company or national totals.</p>
      </aside>
    </div>
  )
}
