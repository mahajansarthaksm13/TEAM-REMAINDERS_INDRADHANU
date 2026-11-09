"use client"

// Simulation Studio controller. It plays the bin's part of the protocol against the real backend:
//   /api/sim/codes   a fresh one-time code (demo products only)
//   /api/sim/open    "may the lid open?"  -> open_deposit_session (pending entry, nothing counted)
//   /api/sim/deposit camera + scale result -> decide_deposit -> signed record -> real ingest
// Camera and scale values come from this browser and are labelled simulated. The bin only moves
// forward on a real server answer (lib/sim-machine.ts), so it can never show a success it didn't get.
import { useEffect, useReducer, useRef, useState } from "react"
import QRCode from "qrcode"
import { Loader2, Play, RotateCcw } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Badge, CategorySwatch, VerdictBanner } from "@/components/vb/ui"
import { browserDb } from "@/lib/supabase-browser"
import { fmtTime } from "@/lib/format"
import { CATEGORY_LABEL, type Category } from "@/lib/shared"
import { SCENARIOS, initialSim, scenarioWeight, sim, withinTolerance, type Scenario, type SimState } from "@/lib/sim-machine"
import { BinTwin, type Drop } from "./bin-twin"
import { CameraView, type CameraPhase } from "./camera-view"
import { Scale } from "./scale"
import { Timeline, type SimEvent } from "./timeline"
import { EvidenceReceipt, type Receipt } from "./receipt"

export type DemoProduct = { id: string; code: string; name: string; category: Category; unit_weight_g: number }
export type FeedItem = { scan_id: string; at: string; weight_g: number; product_id: string | null }
type CodeKind = "fresh" | "unknown" | "reuse"
type Run = { product: DemoProduct; codeKind: CodeKind; camera: boolean; weight: number; title: string }

const STATE_LABEL: Record<SimState, string> = {
  LOCKED: "Locked", QR_SCANNED: "QR scanned", VALIDATING: "Checking with server", OPENING: "Opening", OPEN: "Open",
  DEPOSIT_IN_PROGRESS: "Deposit in progress", CAMERA_VERIFYING: "Camera checking", WEIGHT_CHECKING: "Weighing",
  APPROVED: "Approved", REJECTED: "Rejected", REVIEW_REQUIRED: "Review required", CLOSING: "Closing", CLOSED: "Closed", ERROR: "Error",
}

const REASON: Record<string, [string, string]> = {
  qr_unknown: ["Lid stays shut: unknown code", "VeriBin never issued this code, so the bin refuses to open. No entry is created and nothing is recorded."],
  qr_already_used: ["Lid stays shut: code already used", "This code was deposited once already. One code, one deposit, so a second deposit can never be counted. The original record is unchanged."],
  no_deposit: ["Not counted: nothing went in", "The lid opened, but the camera saw nothing cross the opening and the weight did not change. The scan alone counts for nothing; the code stays unused."],
  camera_not_confirmed: ["Not counted: camera saw nothing", "The weight changed, but the camera saw no item cross the opening. Without both, the deposit is rejected."],
  weight_not_confirmed: ["Not counted: the scale did not move", "The camera saw something, but the scale reading did not change. Without both, the deposit is rejected."],
  timed_out: ["Not counted: the lid timed out", "Nothing was confirmed within 90 seconds, so the entry expired."],
  session_open: ["Lid already open for this code", "This code already has an open lid. Finish or wait for that deposit first."],
  rate_limited: ["Demo limit reached", "Too many tries from this network in a minute. Wait a moment and run it again."],
  demo_not_configured: ["Demo bin not configured", "The demo bin's signing key is not set on this server, so nothing can be recorded."],
  ingest_unreachable: ["Ledger unreachable", "The ingest service did not answer, so nothing was recorded."],
  backend_error: ["Server error", "The server could not complete the request, so nothing was recorded."],
}
const reasonText = (r: string | null) => REASON[r ?? ""] ?? ["Rejected", `The server refused it (${r ?? "unknown reason"}). Nothing was counted.`]

const randomCode = (productCode: string) =>
  `VBQ1.${productCode}.${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`
const short = (code: string) => (code.length > 24 ? `${code.slice(0, 16)}…${code.slice(-6)}` : code)

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json: json as Record<string, unknown> }
}

export function Studio({ products, initialFeed, lastUsedCode }: { products: DemoProduct[]; initialFeed: FeedItem[]; lastUsedCode: string | null }) {
  const [s, dispatch] = useReducer(sim, undefined, initialSim)
  const [events, setEvents] = useState<SimEvent[]>([])
  const [busy, setBusy] = useState(false)
  const [product, setProduct] = useState<DemoProduct | undefined>(products[0])
  const [codeKind, setCodeKind] = useState<CodeKind>("fresh")
  const [camera, setCamera] = useState(true)
  const [weight, setWeight] = useState(products[0]?.unit_weight_g ?? 24)
  const [code, setCode] = useState<string | null>(null)
  const [qr, setQr] = useState<{ code: string; svg: string }>({ code: "", svg: "" })
  const [drop, setDrop] = useState<Drop>("none")
  const [cam, setCam] = useState<CameraPhase>("standby")
  const [camAt, setCamAt] = useState<string | null>(null)
  const [shown, setShown] = useState<number | null>(null)
  const [shake, setShake] = useState(0)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [verdictWeight, setVerdictWeight] = useState<number | null>(null)
  const [feed, setFeed] = useState(initialFeed)
  const [fresh, setFresh] = useState<string | null>(null)
  const [feedLive, setFeedLive] = useState(false)
  const [server, setServer] = useState<"idle" | "waiting" | "answered" | "error">("idle")
  const lastCode = useRef<string | null>(lastUsedCode)
  const seq = useRef(0)
  const reduce = useRef(false)

  useEffect(() => {
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // Realtime: the ingest Edge Function broadcasts every accepted demo deposit on `demo`.
  useEffect(() => {
    const sb = browserDb()
    const ch = sb
      .channel("demo", { config: { private: true } })
      .on("broadcast", { event: "scan" }, ({ payload }) => {
        const item = { scan_id: String(payload.scan_id), at: new Date().toISOString(), weight_g: Number(payload.weight_g), product_id: payload.product_id ? String(payload.product_id) : null }
        setFeed((cur) => [item, ...cur.filter((x) => x.scan_id !== item.scan_id)].slice(0, 8))
        setFresh(item.scan_id)
      })
      .subscribe((st) => setFeedLive(st === "SUBSCRIBED"))
    return () => {
      sb.removeChannel(ch)
    }
  }, [])

  // The QR image belongs to one code; a stale image for an earlier code is never shown.
  useEffect(() => {
    if (!code) return
    QRCode.toString(code, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#171123", light: "#FBFBFB" } }).then(
      (svg) => setQr({ code, svg }),
      () => setQr({ code, svg: "" })
    )
  }, [code])
  const qrSvg = code && qr.code === code ? qr.svg : ""

  const wait = (ms: number) => new Promise((r) => setTimeout(r, reduce.current ? 0 : ms))
  const log = (label: string, source: SimEvent["source"], tone?: SimEvent["tone"], detail?: unknown, at?: string) =>
    setEvents((cur) => [...cur, { id: ++seq.current, at: at ?? new Date().toISOString(), label, source, tone, detail }])

  async function tweenWeight(to: number) {
    const steps = reduce.current ? 1 : 10
    for (let i = 1; i <= steps; i++) {
      setShown(Math.round((to * i) / steps))
      await wait(70)
    }
  }

  async function run(r: Run) {
    if (busy) return
    setBusy(true)
    dispatch({ type: "RESET" })
    setEvents([])
    setReceipt(null)
    setDrop("none")
    setCam("standby")
    setCamAt(null)
    setShown(null)
    setVerdictWeight(null)
    setServer("idle")
    log(`${r.title}: ${r.product.name}`, "simulated")
    try {
      // 1. The code on the packet
      let c: string | null
      if (r.codeKind === "fresh") {
        setServer("waiting")
        const res = await post("/api/sim/codes", { product_id: r.product.id })
        if (res.status !== 200) throw new Error(String(res.json.reason ?? "backend_error"))
        c = String(res.json.code)
        setServer("answered")
        log(`Fresh one-time QR code issued for ${r.product.code}`, "server", undefined, { code: c })
      } else if (r.codeKind === "unknown") {
        c = randomCode(r.product.code)
        log("Packet carries a code VeriBin never issued", "simulated", undefined, { code: c })
      } else {
        c = lastCode.current
        if (!c) {
          log("No code has been deposited yet. Run “Genuine deposit” first, then try this again.", "simulated", "warn")
          return
        }
        log("Packet carries a code that was already deposited", "simulated", undefined, { code: c })
      }
      setCode(c)
      setDrop("above")

      // 2. Scan, then ask the server whether the lid may open
      dispatch({ type: "SCAN", code: c })
      log(`Scanner read ${short(c)}`, "simulated")
      await wait(650)
      dispatch({ type: "VALIDATE" })
      setServer("waiting")
      const open = await post("/api/sim/open", { code: c })
      if (open.status === 429 || open.status >= 500) throw new Error(String(open.json.reason ?? "backend_error"))
      setServer("answered")
      if (!open.json.ok) {
        dispatch({ type: "OPEN_REFUSED", reason: String(open.json.reason) })
        setShake((k) => k + 1)
        setDrop("none")
        log(reasonText(String(open.json.reason))[0], "server", "bad", open.json, String(open.json.answered_at ?? ""))
        return
      }
      const product = open.json.product as DemoProduct
      dispatch({ type: "OPEN_OK", sessionId: String(open.json.session_id), product })
      log("Code is registered and unused: lid may open. Pending entry created, nothing counted yet.", "server", "ok", open.json, String(open.json.answered_at ?? ""))
      await wait(700)
      dispatch({ type: "LID_OPEN" })
      log("Lid opened", "simulated")
      await wait(600)

      // 3. The deposit itself, as the camera and scale would report it
      dispatch({ type: "DROP" })
      setDrop(r.camera ? "falling" : "hovering")
      log(r.camera ? `${product.name} dropped into the bin` : "Lid is open, but nothing goes in", "simulated")
      await wait(500)
      dispatch({ type: "CAMERA" })
      setCam("watching")
      await wait(1100)
      setCam(r.camera ? "seen" : "nothing")
      setCamAt(new Date().toLocaleTimeString("en-IN", { hour12: false }))
      log(r.camera ? "Camera: an item crossed the opening" : "Camera: nothing crossed the opening", "simulated", r.camera ? undefined : "warn", { camera_seen: r.camera })
      dispatch({ type: "WEIGH" })
      await tweenWeight(r.weight)
      log(`Scale: ${r.weight} g (catalogue weight ${product.unit_weight_g} g)`, "simulated", r.weight > 0 && !withinTolerance(r.weight, product.unit_weight_g) ? "warn" : undefined, { weight_g: r.weight })

      // 4. The server decides, and only then the ledger
      setServer("waiting")
      const dep = await post("/api/sim/deposit", { session_id: open.json.session_id, camera_seen: r.camera, weight_g: r.weight })
      if (dep.status === 429 || dep.status >= 500 || dep.json.status === "error") throw new Error(String(dep.json.reason ?? "backend_error"))
      setServer("answered")
      const d = dep.json as Record<string, string | number | boolean | null>
      if (d.stage === "policy") {
        log(`Deposit policy: ${reasonText(String(d.reason))[0]}`, "server", "bad", d, String(d.decided_at))
      } else {
        if (d.record) log(`Bin signed the record; ledger checked the signature and chained it as #${d.sequence}`, "ledger", d.status === "rejected" ? "bad" : "ok", { record: d.record, chain_hash: d.chain_hash, weight_ok: d.weight_ok }, String(d.answered_at))
        log(d.status === "approved" ? "Deposit approved and counted" : d.status === "review" ? "Recorded, flagged for review: weight outside tolerance" : reasonText(String(d.reason))[0], "server", d.status === "approved" ? "ok" : d.status === "review" ? "warn" : "bad", { status: d.status, reason: d.reason, scan_id: d.scan_id })
      }
      const status = d.status === "approved" || d.status === "review" ? d.status : "rejected"
      const rc = status !== "rejected" && d.record
        ? ({ scan_id: String(d.scan_id), record: String(d.record), signature: String(d.signature), record_hash: String(d.record_hash), prev_hash: String(d.prev_hash), chain_hash: String(d.chain_hash), public_key: String(d.public_key), sequence: Number(d.sequence), weight_ok: d.weight_ok as boolean | null, status } as Receipt)
        : null
      dispatch({ type: "SERVER_RESULT", status, reason: d.reason ? String(d.reason) : null, receipt: rc })
      setVerdictWeight(r.weight)
      if (rc) {
        setReceipt(rc)
        lastCode.current = c
      }
      setDrop(r.camera ? "inside" : "none")
      await wait(1400)
      dispatch({ type: "CLOSE" })
      log("Lid closing", "simulated")
      await wait(700)
      dispatch({ type: "CLOSED" })
    } catch (e) {
      const reason = e instanceof Error ? e.message : "backend_error"
      setServer("error")
      dispatch({ type: "FAIL", message: reason })
      log(`${reasonText(reason)[0]}. Nothing was recorded.`, "server", "bad", { reason })
    } finally {
      setBusy(false)
    }
  }

  const runScenario = (sc: Scenario) => {
    const p = product ?? products[0]
    if (!p) return
    const w = scenarioWeight(sc, p.unit_weight_g)
    setCodeKind(sc.code)
    setCamera(sc.camera)
    setWeight(w)
    run({ product: p, codeKind: sc.code, camera: sc.camera, weight: w, title: `Scenario ${sc.id} · ${sc.title}` })
  }

  const p = product ?? products[0]
  const final = s.state === "APPROVED" || s.state === "REVIEW_REQUIRED" || s.state === "REJECTED" || s.state === "ERROR" || (s.state === "CLOSING" || s.state === "CLOSED")
  const verdict = verdictFor(s.state === "CLOSING" || s.state === "CLOSED" ? (receipt?.status === "approved" ? "APPROVED" : receipt?.status === "review" ? "REVIEW_REQUIRED" : "REJECTED") : s.state, s.reason, s.product?.name, verdictWeight, s.product?.unit_weight_g, receipt?.sequence ?? null, s.error)
  const productName = (id: string | null) => products.find((x) => x.id === id)?.name ?? "Demo item"
  const expectedOf = (id: string | null) => products.find((x) => x.id === id)?.unit_weight_g ?? 0

  if (!p) return <VerdictBanner kind="error" title="The demo bin isn't set up on this server">Demo products could not be loaded.</VerdictBanner>

  return (
    <div className="grid gap-6">
      {/* ── Judge demo rail ─────────────────────────────── */}
      <section className="neu rounded-card p-4 sm:p-6" aria-label="Judge demo">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-dim">Judge demo · one click each</p>
            <h2 className="t-h3 mt-1">Pick a story, watch the bin decide</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={busy} onClick={() => runScenario(SCENARIOS[0])}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />}Run complete deposit
            </Button>
            <Button size="lg" variant="secondary" disabled={busy} onClick={() => { dispatch({ type: "RESET" }); dispatch({ type: "CLEAR_SCORE" }); setEvents([]); setReceipt(null); setDrop("none"); setCam("standby"); setShown(null); setCode(null); setServer("idle") }}>
              <RotateCcw />Reset
            </Button>
          </div>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SCENARIOS.map((sc) => (
            <li key={sc.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => runScenario(sc)}
                className="neu-press flex h-full w-full flex-col items-start gap-1 rounded-[14px] p-3 text-left transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-violet text-xs text-snow">{sc.id}</span>
                  {sc.title}
                </span>
                <span className="text-xs text-dim">{sc.story}</span>
                <span className="mt-auto pt-1 text-xs font-semibold">→ {sc.expect}</span>
              </button>
            </li>
          ))}
        </ol>

        <details className="mt-4 rounded-[14px] bg-panel-hi p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Manual controls: build your own deposit</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-4">
            <fieldset className="grid gap-1.5">
              <legend className="eyebrow mb-1 text-dim">Packet</legend>
              {products.map((x) => (
                <label key={x.id} className="flex items-center gap-2">
                  <input type="radio" name="sim-product" checked={p.id === x.id} onChange={() => { setProduct(x); setWeight(x.unit_weight_g) }} className="accent-[var(--violet)]" />
                  <CategorySwatch category={x.category} />
                  {x.name} <span className="text-dim">· {x.unit_weight_g} g</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="grid gap-1.5">
              <legend className="eyebrow mb-1 text-dim">Code on the packet</legend>
              {(["fresh", "unknown", "reuse"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="sim-code" checked={codeKind === k} onChange={() => setCodeKind(k)} className="accent-[var(--violet)]" />
                  {k === "fresh" ? "Registered, unused" : k === "unknown" ? "Never issued (fake)" : "Already deposited"}
                </label>
              ))}
            </fieldset>
            <fieldset className="grid gap-1.5">
              <legend className="eyebrow mb-1 text-dim">Camera (simulated)</legend>
              <label className="flex items-center gap-2"><input type="radio" name="sim-cam" checked={camera} onChange={() => setCamera(true)} className="accent-[var(--violet)]" />Item goes in</label>
              <label className="flex items-center gap-2"><input type="radio" name="sim-cam" checked={!camera} onChange={() => setCamera(false)} className="accent-[var(--violet)]" />Nothing goes in</label>
            </fieldset>
            <div className="grid content-start gap-1.5">
              <label htmlFor="sim-weight" className="eyebrow text-dim">Scale (simulated): {weight} g</label>
              <input id="sim-weight" type="range" min={0} max={Math.round(p.unit_weight_g * 4.5)} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="accent-[var(--violet)]" />
              <Button disabled={busy} onClick={() => run({ product: p, codeKind, camera, weight, title: "Manual deposit" })}>
                {busy ? <Loader2 className="animate-spin" /> : <Play />}Scan and deposit
              </Button>
            </div>
          </div>
        </details>
      </section>

      {/* ── The twin, its sensors, and its health ───────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="neu rounded-card p-4 sm:p-6 lg:col-span-4" aria-label="Virtual smart bin">
          <p className="eyebrow text-dim">Smart bin · VB-PUN-9999-DEMO</p>
          <div className="mt-2 flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="rounded-badge border border-dashed border-line-strong px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-dim uppercase">Simulated hardware</span>
            <Badge kind={s.state === "APPROVED" ? "approved" : s.state === "REVIEW_REQUIRED" ? "flagged" : s.state === "REJECTED" || s.state === "ERROR" ? "error" : "neutral"}>{STATE_LABEL[s.state]}</Badge>
            {busy && <Loader2 className="size-4 animate-spin text-dim" aria-hidden />}
          </div>
          <div className="mt-4 flex justify-center">
            <BinTwin key={shake} state={s.state} drop={drop} category={(s.product?.category as Category) ?? p.category} refused={shake > 0 && s.state === "REJECTED" && !s.lidOpened} />
          </div>
          <StateRail state={s.state} />
        </section>

        <section className="neu grid gap-4 rounded-card p-4 sm:p-6 lg:col-span-5" aria-label="Sensors">
          <div className="grid grid-cols-[96px_1fr] items-center gap-4">
            <div className="neu-inset flex aspect-square items-center justify-center rounded-[14px] p-2">
              {qrSvg ? <span className="block w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <span className="text-center text-[10px] text-dim">QR appears here</span>}
            </div>
            <div className="min-w-0">
              <p className="eyebrow text-dim">Scanner · reads the packet</p>
              <p className="mt-1 flex items-center gap-2 font-semibold"><CategorySwatch category={(s.product?.category as Category) ?? p.category} />{s.product?.name ?? p.name}</p>
              <p className="text-xs text-dim">{CATEGORY_LABEL[(s.product?.category as Category) ?? p.category]} · catalogue {s.product?.unit_weight_g ?? p.unit_weight_g} g</p>
              <p className="mt-1 truncate font-mono text-[11px] text-dim" title={code ?? ""}>{code ?? "No code scanned yet"}</p>
            </div>
          </div>
          <CameraView phase={cam} itemName={s.product?.name ?? p.name} at={camAt} />
          <Scale weight={shown} expected={s.product?.unit_weight_g ?? p.unit_weight_g} active={s.state === "WEIGHT_CHECKING"} />
        </section>

        <aside className="grid content-start gap-4 lg:col-span-3" aria-label="Diagnostics and score">
          <div className="neu rounded-card p-4">
            <p className="eyebrow mb-3 text-dim">Diagnostics</p>
            <ul className="grid gap-2 text-sm">
              <Light label="Scanner" sim value={s.state === "QR_SCANNED" ? "Reading" : s.state === "LOCKED" || s.state === "CLOSED" ? "Ready" : "Read"} on={s.state !== "LOCKED"} />
              <Light label="Lid" sim value={s.lidOpened ? (s.state === "CLOSING" ? "Closing" : "Open") : "Locked"} on={s.lidOpened} />
              <Light label="Camera" sim value={cam === "standby" ? "Standby" : cam === "watching" ? "Watching" : cam === "seen" ? "Item seen" : "Nothing seen"} on={cam !== "standby"} />
              <Light label="Scale" sim value={shown == null ? "Standby" : `${shown} g`} on={shown != null} />
              <Light label="Server" value={server === "waiting" ? "Waiting…" : server === "answered" ? "Answered" : server === "error" ? "Unreachable" : "Idle"} on={server === "answered"} bad={server === "error"} />
              <Light label="Ledger" value={receipt ? `Record #${receipt.sequence}` : final && s.state !== "ERROR" ? "Not written" : "—"} on={!!receipt} />
              <Light label="Realtime" value={feedLive ? "Live" : "Connecting"} on={feedLive} />
            </ul>
          </div>
          <Scoreboard tally={s.tally} />
        </aside>
      </div>

      {verdict && <VerdictBanner kind={verdict.kind} title={verdict.title}>{verdict.body}</VerdictBanner>}

      {/* ── What happened, and the proof ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="neu rounded-card p-4 sm:p-6 lg:col-span-7" aria-label="Event timeline">
          <p className="eyebrow mb-3 text-dim">Event timeline · real server times</p>
          <Timeline events={events} />
        </section>
        <section className="neu grid content-start gap-4 rounded-card p-4 sm:p-6 lg:col-span-5" aria-label="Live feed">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-dim">Live ledger feed · demo bin</p>
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={cn("size-2 rounded-full", feedLive ? "soft-pulse bg-violet" : "bg-line-strong")} />
              {feedLive ? "Live" : "Connecting…"}
            </span>
          </div>
          {feed.length === 0 ? (
            <p className="text-sm text-dim">No demo deposits yet. Run “Genuine deposit”.</p>
          ) : (
            <ul className="divide-y divide-line" aria-live="polite">
              {feed.map((f) => {
                const exp = expectedOf(f.product_id)
                const ok = exp ? withinTolerance(f.weight_g, exp) : true
                return (
                  <li key={f.scan_id} className={cn("flex items-center justify-between gap-3 rounded-[10px] px-2 py-2.5 text-sm", f.scan_id === fresh && "feed-in")}>
                    <span className="min-w-0 truncate">{productName(f.product_id)} · {f.weight_g} g</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge kind={ok ? "approved" : "flagged"}>{ok ? "Counted" : "Review"}</Badge>
                      <span className="tnum text-xs text-dim">{fmtTime(f.at)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-xs text-dim">Arrives through the same realtime broadcast the company dashboards use. Demo deposits never count toward company or national totals.</p>
        </section>
      </div>

      {receipt && (
        <section className="neu rounded-card p-4 sm:p-6" aria-label="Evidence receipt">
          <p className="eyebrow text-dim">Evidence receipt</p>
          <h2 className="t-h3 mt-1 mb-4">Don&apos;t trust us. Check it yourself.</h2>
          <EvidenceReceipt r={receipt} />
        </section>
      )}
    </div>
  )
}

function Light({ label, value, on, bad, sim: simulated }: { label: string; value: string; on: boolean; bad?: boolean; sim?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", bad ? "bg-night" : on ? "bg-violet" : "bg-line-strong")} aria-hidden />
        {label}
        {simulated && <span className="rounded-badge border border-dashed border-line-strong px-1 text-[9px] tracking-wider text-dim uppercase">sim</span>}
      </span>
      <span className="tnum text-xs font-semibold">{value}</span>
    </li>
  )
}

function Scoreboard({ tally }: { tally: { scans: number; opened: number; counted: number; review: number; blocked: number } }) {
  const rows: [string, number][] = [["Scans attempted", tally.scans], ["Lid openings", tally.opened], ["Deposits counted", tally.counted], ["Sent for review", tally.review], ["Blocked or rejected", tally.blocked]]
  return (
    <div className="neu rounded-card p-4">
      <p className="eyebrow mb-3 text-dim">Why it matters · this session</p>
      <dl className="grid gap-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt>{k}</dt>
            <dd className="tnum font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="neu-inset rounded-[12px] p-2">
          <p className="t-kpi tnum text-2xl">{tally.scans}</p>
          <p className="text-[11px] text-dim">a scan-counter would count</p>
        </div>
        <div className="rounded-[12px] bg-violet p-2 text-snow">
          <p className="t-kpi tnum text-2xl">{tally.counted}</p>
          <p className="text-[11px] opacity-80">VeriBin counted</p>
        </div>
      </div>
    </div>
  )
}

const RAIL: SimState[] = ["LOCKED", "VALIDATING", "OPEN", "CAMERA_VERIFYING", "WEIGHT_CHECKING", "APPROVED"]
const RAIL_LABEL = ["Locked", "Code check", "Lid open", "Camera", "Scale", "Decision"]
const ORDER: SimState[] = ["LOCKED", "QR_SCANNED", "VALIDATING", "OPENING", "OPEN", "DEPOSIT_IN_PROGRESS", "CAMERA_VERIFYING", "WEIGHT_CHECKING", "APPROVED"]

function StateRail({ state }: { state: SimState }) {
  const terminal = state === "APPROVED" || state === "REJECTED" || state === "REVIEW_REQUIRED" || state === "CLOSING" || state === "CLOSED"
  const at = terminal ? ORDER.length - 1 : Math.max(0, ORDER.indexOf(state))
  return (
    <ol className="mt-4 grid grid-cols-6 gap-1" aria-label="Bin state">
      {RAIL.map((r, i) => {
        const reached = ORDER.indexOf(r) <= at && state !== "LOCKED" && state !== "ERROR"
        return (
          <li key={r} className="flex flex-col items-center gap-1 text-center">
            <span className={cn("h-1.5 w-full rounded-full", reached ? "bg-violet" : "bg-chip")} />
            <span className={cn("text-[10px] leading-tight", reached ? "font-semibold" : "text-dim")}>{RAIL_LABEL[i]}</span>
          </li>
        )
      })}
    </ol>
  )
}

function verdictFor(state: SimState, reason: string | null, name?: string, weight?: number | null, unit?: number, sequence?: number | null, error?: string | null) {
  if (state === "APPROVED")
    return { kind: "success" as const, title: "Deposit verified and counted", body: `The camera saw the ${name ?? "item"} go in and the scale read ${weight ?? "?"} g, as expected. The bin signed the record and the ledger chained it${sequence ? ` as #${sequence}` : ""}. It now counts, and anyone can verify it below.` }
  if (state === "REVIEW_REQUIRED")
    return { kind: "warning" as const, title: "Recorded, but sent for review", body: `The camera saw an item go in, but it weighed ${weight ?? "?"} g instead of about ${unit ?? "?"} g. It is signed and kept as evidence, but flagged and left out of reports until someone checks it.` }
  if (state === "REJECTED") {
    const [title, body] = reasonText(reason)
    return { kind: "error" as const, title, body }
  }
  if (state === "ERROR") {
    const [title, body] = reasonText(error ?? "backend_error")
    return { kind: "error" as const, title, body }
  }
  return null
}
