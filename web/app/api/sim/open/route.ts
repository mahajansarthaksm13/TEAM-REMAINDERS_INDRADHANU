import { NextResponse, type NextRequest } from "next/server"
import { serviceDb } from "@/lib/supabase"
import { DEMO_BIN, callerIp, rateLimited } from "@/lib/demo-bin"

// Step 1 of the bin protocol: "may the lid open for this code?" The database pre-checks the
// code (same rules as the ledger) and either refuses or opens a pending entry. Nothing is counted.
export async function POST(req: NextRequest) {
  if (rateLimited(callerIp(req))) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const code = typeof body?.code === "string" ? body.code.trim().slice(0, 80) : ""
  const received_at = new Date().toISOString()
  const { data, error } = await serviceDb().rpc("open_deposit_session", { p_bin_id: DEMO_BIN, p_code: code })
  if (error) return NextResponse.json({ ok: false, reason: "backend_error" }, { status: 502 })
  return NextResponse.json({ ...(data as object), bin_id: DEMO_BIN, received_at, answered_at: new Date().toISOString() })
}
