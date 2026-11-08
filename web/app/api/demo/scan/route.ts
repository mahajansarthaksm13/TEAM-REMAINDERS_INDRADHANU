import { createHash, createPrivateKey, sign } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { SUPABASE_URL, serviceDb } from "@/lib/supabase"

// A16 website simulator. The server signs a record with the demo bin's private key
// (server-only env var) and sends it through the real ingest Edge Function.
const BIN = process.env.DEMO_BIN_ID || "VB-PUN-9999-DEMO"
const BARCODE = process.env.DEMO_BARCODE || "8900000099999" // seeded demo product P9999
const WEIGHT_G = 24
const INGEST_URL = process.env.INGEST_URL || `${SUPABASE_URL}/functions/v1/ingest`
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex")

// ponytail: per-process limiter (10 / 60 s per IP); production relies on the Vercel firewall rule (Spec B9).
const hits = new Map<string, number[]>()
function limited(ip: string) {
  const now = Date.now()
  const h = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (h.length >= 10) return true
  hits.set(ip, [...h, now])
  return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local"
  if (limited(ip)) return NextResponse.json({ reason: "rate_limited" }, { status: 429 })
  const seed = process.env.DEMO_BIN_PRIVATE_KEY
  if (!seed) return NextResponse.json({ reason: "demo_not_configured" }, { status: 503 })

  const { data: bin, error } = await serviceDb().from("bins").select("last_sequence, chain_head, public_key").eq("id", BIN).maybeSingle()
  if (error || !bin) return NextResponse.json({ reason: "unknown_bin" }, { status: 502 })

  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(seed, "base64")]), format: "der", type: "pkcs8" })
  const at = new Date().toISOString().slice(0, 19) + "Z"
  const record = `v1|${BIN}|${Number(bin.last_sequence) + 1}|${at}|barcode|${BARCODE}|${WEIGHT_G}`
  const signature = sign(null, Buffer.from(record, "utf8"), key).toString("base64")

  let res: Response
  try {
    res = await fetch(INGEST_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ record, signature }) })
  } catch {
    return NextResponse.json({ reason: "ingest_unreachable" }, { status: 502 })
  }
  const out = await res.json().catch(() => ({}))
  if (out.status !== "accepted") return NextResponse.json({ reason: out.reason ?? "rejected", record, signature }, { status: 502 })
  return NextResponse.json({
    scan_id: out.scan_id,
    record,
    signature,
    record_hash: createHash("sha256").update(record, "utf8").digest("hex"),
    prev_hash: bin.chain_head,
    chain_hash: out.chain_hash,
    public_key: bin.public_key,
    scanned_at: out.scanned_at,
  })
}
