// The website's demo bin, server side only. The server holds the demo bin's private key
// (server-only env var), signs exactly what a real bin would sign, and sends it through the
// real ingest Edge Function. Used by the Simulation Studio routes under app/api/sim.
import { createHash, createPrivateKey, sign } from "node:crypto"
import { SUPABASE_URL, serviceDb } from "./supabase"

export const DEMO_BIN = process.env.DEMO_BIN_ID || "VB-PUN-9999-DEMO"
const INGEST_URL = process.env.INGEST_URL || `${SUPABASE_URL}/functions/v1/ingest`
const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex")

// ponytail: per-process limiter keyed by IP; production relies on the Vercel firewall rule (Spec B9).
const hits = new Map<string, number[]>()
export function rateLimited(ip: string, perMinute = 40) {
  const now = Date.now()
  const h = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  if (h.length >= perMinute) return true
  hits.set(ip, [...h, now])
  return false
}
export const callerIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local"

export type Ingested = {
  ok: boolean
  reason: string | null
  out: Record<string, unknown>
  record: string
  signature: string
  record_hash: string
  prev_hash: string
  public_key: string
  sent_at: string
  answered_at: string
}

// Sign one deposit record and send it to the real ledger. Retries once if another visitor took
// the same sequence number at the same moment (duplicate_sequence).
export async function signAndIngest(code: string, weightG: number): Promise<Ingested | { ok: false; reason: string }> {
  const seed = process.env.DEMO_BIN_PRIVATE_KEY
  if (!seed) return { ok: false, reason: "demo_not_configured" }
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(seed, "base64")]), format: "der", type: "pkcs8" })

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: bin, error } = await serviceDb().from("bins").select("last_sequence, chain_head, public_key").eq("id", DEMO_BIN).maybeSingle()
    if (error || !bin) return { ok: false, reason: "unknown_bin" }
    const at = new Date().toISOString().slice(0, 19) + "Z"
    const record = `v1|${DEMO_BIN}|${Number(bin.last_sequence) + 1}|${at}|qr|${code}|${weightG}`
    const signature = sign(null, Buffer.from(record, "utf8"), key).toString("base64")
    const sent_at = new Date().toISOString()
    let out: Record<string, unknown>
    try {
      const res = await fetch(INGEST_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ record, signature }) })
      out = await res.json().catch(() => ({}))
    } catch {
      return { ok: false, reason: "ingest_unreachable" }
    }
    if (out.reason === "duplicate_sequence" && attempt === 0) continue
    return {
      ok: out.status === "accepted",
      reason: out.status === "accepted" ? null : String(out.reason ?? "rejected"),
      out,
      record,
      signature,
      record_hash: createHash("sha256").update(record, "utf8").digest("hex"),
      prev_hash: bin.chain_head,
      public_key: bin.public_key,
      sent_at,
      answered_at: new Date().toISOString(),
    }
  }
  return { ok: false, reason: "duplicate_sequence" }
}
