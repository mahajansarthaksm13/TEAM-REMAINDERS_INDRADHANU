import { NextResponse, type NextRequest } from "next/server"
import { serviceDb } from "@/lib/supabase"
import { callerIp, rateLimited, signAndIngest } from "@/lib/demo-bin"
import { UUID_RE } from "@/lib/shared"
import type { Json } from "@/lib/database.types"

// Step 2 of the bin protocol: the bin reports what its (simulated) camera and scale saw.
// 1. decide_deposit applies the deposit policy in the database.
// 2. Only "submit" is signed and sent to the real ledger (ingest Edge Function -> ingest_scan).
// 3. record_deposit_result stores the ledger's answer: approved, review or rejected.
// The browser never decides; an error is reported as an error, never as success.
export async function POST(req: NextRequest) {
  if (rateLimited(callerIp(req))) return NextResponse.json({ status: "error", reason: "rate_limited" }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.session_id === "string" ? body.session_id : ""
  const camera = body?.camera_seen === true
  const weight = Number.isInteger(body?.weight_g) ? Number(body.weight_g) : -1
  if (!UUID_RE.test(sessionId) || weight < 0 || weight > 5000) return NextResponse.json({ status: "error", reason: "bad_request" }, { status: 400 })

  const db = serviceDb()
  const received_at = new Date().toISOString()
  const decided = await db.rpc("decide_deposit", { p_session: sessionId, p_camera_seen: camera, p_weight_g: weight })
  if (decided.error) return NextResponse.json({ status: "error", reason: "backend_error" }, { status: 502 })
  const d = decided.data as { decision: string; status?: string; reason?: string; code?: string; weight_g?: number }
  const decided_at = new Date().toISOString()
  if (d.decision !== "submit") {
    return NextResponse.json({ status: d.status ?? "rejected", reason: d.reason ?? null, stage: "policy", received_at, decided_at })
  }

  const sent = await signAndIngest(d.code!, weight)
  const ledger = "out" in sent ? sent : null
  const result = ledger?.ok ? ledger.out : { status: "rejected", reason: sent.reason }
  const recorded = await db.rpc("record_deposit_result", { p_session: sessionId, p_result: result as Json })
  if (recorded.error) return NextResponse.json({ status: "error", reason: "backend_error" }, { status: 502 })
  const r = recorded.data as { status: string; reason: string | null; scan_id: string | null }
  return NextResponse.json({
    status: r.status,
    reason: r.reason,
    stage: "ledger",
    scan_id: r.scan_id,
    received_at,
    decided_at,
    ...(ledger && {
      record: ledger.record,
      signature: ledger.signature,
      record_hash: ledger.record_hash,
      prev_hash: ledger.prev_hash,
      chain_hash: (ledger.out.chain_hash as string) ?? null,
      public_key: ledger.public_key,
      weight_ok: ledger.out.weight_ok ?? null,
      sequence: ledger.out.sequence ?? null,
      sent_at: ledger.sent_at,
      answered_at: ledger.answered_at,
    }),
  })
}
