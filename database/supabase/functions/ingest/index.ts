// =============================================================================
// D6 · VeriBin ingest Edge Function
//
// The only public door into the platform. A bin (or the simulator) signs a
// record and posts it here. This function decides whether the sender is who it
// claims to be, then hands the record to the database function, which decides
// whether the record is valid.
//
// Order, per the task sheet:
//   POST only
//   -> validate the body and every field
//   -> look up the bin's public key (cached 60 s)
//   -> verify Ed25519 over the EXACT text received
//   -> call public.ingest_scan
//   -> broadcast to the company's private channel on success
//
// The signature is verified over the received string, never a rebuilt one, so
// firmware, simulator and server can never disagree about what was signed.
//
// HTTP status map (the `status` field in the body is the reliable signal):
//   200 accepted, or rejected by the database (400 too, see below)
//   400 bad_format
//   401 unknown_bin, bad_signature
//   405 bad_method
//   500 internal_error
// =============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BIN_ID_RE = /^VB-[A-Z]{3}-[0-9]{4}(-DEMO)?$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SEQUENCE_RE = /^[0-9]{1,19}$/;
const WEIGHT_RE = /^[0-9]{1,5}$/;
const BARCODE_RE = /^[0-9]{8,14}$/;
const QR_RE = /^VBQ1\.P[0-9]{4}\.[0-9a-f]{32}$/;

const MAX_RECORD_LEN = 512;
const MAX_SIGNATURE_LEN = 256;
const MAX_WEIGHT_G = 5000;

// -----------------------------------------------------------------------------
// Public key cache. Edge Function isolates are reused while warm, so this holds
// a key for up to 60 seconds. Revocation is not cached: ingest_scan re-checks
// bin status on every call.
// -----------------------------------------------------------------------------

type CacheEntry = { publicKey: string | null; expiresAt: number };
const keyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

async function getPublicKey(binId: string): Promise<string | null> {
  const now = Date.now();
  const hit = keyCache.get(binId);
  if (hit && hit.expiresAt > now) return hit.publicKey;

  const { data, error } = await supabase
    .from("bins")
    .select("public_key")
    .eq("id", binId)
    .maybeSingle();

  const publicKey = error || !data ? null : (data.public_key as string);
  keyCache.set(binId, { publicKey, expiresAt: now + CACHE_TTL_MS });
  return publicKey;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function b64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

async function verifyEd25519(
  publicKeyB64: string,
  signatureB64: string,
  text: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      b64ToBuffer(publicKeyB64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      b64ToBuffer(signatureB64),
      new TextEncoder().encode(text),
    );
  } catch {
    // A malformed key or signature is a failed verification, not a crash.
    return false;
  }
}

async function logRejection(
  binId: string | null,
  record: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("log_rejection", {
    p_bin_id: binId,
    p_record: record,
    p_reason: reason,
  });
  if (error) console.error("log_rejection failed", reason, error.message);
}

async function broadcastScan(
  companyId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          { topic: `company:${companyId}`, event: "scan", payload },
        ],
      }),
    });
    if (!res.ok) {
      console.error("broadcast failed", res.status, await res.text());
    }
  } catch (err) {
    // A missed broadcast must never reject a scan that is already in the ledger.
    // The dashboard refetches every 60 seconds anyway.
    console.error("broadcast threw", err);
  }
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json({ status: "rejected", reason: "bad_method" }, 405);
  }

  // ---- body ----------------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }

  const record = body?.record;
  const signature = body?.signature;

  if (typeof record !== "string" || typeof signature !== "string") {
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }
  if (record.length === 0 || record.length > MAX_RECORD_LEN) {
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }
  if (signature.length === 0 || signature.length > MAX_SIGNATURE_LEN) {
    return json({ status: "rejected", reason: "bad_signature" }, 401);
  }

  // ---- field validation ----------------------------------------------------
  const fields = record.split("|");
  if (fields.length !== 7) {
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }

  const [version, binId, sequence, scannedAt, codeType, code, weightG] = fields;

  const binIdValid = BIN_ID_RE.test(binId);
  const fieldsValid =
    version === "v1" &&
    binIdValid &&
    SEQUENCE_RE.test(sequence) &&
    BigInt(sequence) > 0n &&
    TIMESTAMP_RE.test(scannedAt) &&
    (codeType === "qr" || codeType === "barcode") &&
    code.length > 0 &&
    code.length <= 64 &&
    (codeType === "qr" ? QR_RE.test(code) : BARCODE_RE.test(code)) &&
    WEIGHT_RE.test(weightG) &&
    Number(weightG) <= MAX_WEIGHT_G;

  if (!fieldsValid) {
    await logRejection(binIdValid ? binId : null, record, "bad_format");
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }

  // ---- who is this? --------------------------------------------------------
  const publicKey = await getPublicKey(binId);
  if (!publicKey) {
    await logRejection(binId, record, "unknown_bin");
    return json({ status: "rejected", reason: "unknown_bin" }, 401);
  }

  // ---- is it really them? --------------------------------------------------
  const signatureOk = await verifyEd25519(publicKey, signature, record);
  if (!signatureOk) {
    await logRejection(binId, record, "bad_signature");
    return json({ status: "rejected", reason: "bad_signature" }, 401);
  }

  // ---- is the record valid? ------------------------------------------------
  const { data, error } = await supabase.rpc("ingest_scan", {
    p_record: record,
    p_signature: signature,
  });

  if (error) {
    console.error("ingest_scan failed", error.message);
    return json({ status: "rejected", reason: "internal_error" }, 500);
  }

  const result = data as Record<string, unknown>;

  if (result?.status !== "accepted") {
    return json(result, 400);
  }

  // ---- tell the company's dashboard ----------------------------------------
  await broadcastScan(String(result.company_id), {
    scan_id: result.scan_id,
    bin_id: result.bin_id,
    product_id: result.product_id,
    category: result.category,
    weight_g: result.weight_g,
    scanned_at: result.scanned_at,
    chain_hash: result.chain_hash,
  });

  return json(result, 200);
});
