// =============================================================================
// D12 · VeriBin heartbeat Edge Function
//
// A bin (or the simulator) proves it is alive every few minutes:
//   POST { "message": "hb1|<bin_id>|<sent_at>", "signature": "<base64 Ed25519>" }
//   sent_at format: YYYY-MM-DDTHH:MM:SSZ, must be within 5 minutes of now.
//
// config.toml:  [functions.heartbeat]  verify_jwt = false
// =============================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MESSAGE_RE = /^hb1\|(VB-[A-Z]{3}-[0-9]{4}(?:-DEMO)?)\|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/;
const MAX_SKEW_MS = 5 * 60 * 1000;

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

async function verifyEd25519(pubB64: string, sigB64: string, text: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", b64ToBuffer(pubB64), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, b64ToBuffer(sigB64), new TextEncoder().encode(text));
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ status: "rejected", reason: "bad_method" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }

  const message = body?.message;
  const signature = body?.signature;
  if (typeof message !== "string" || typeof signature !== "string" || signature.length > 256) {
    return json({ status: "rejected", reason: "bad_format" }, 400);
  }

  const m = MESSAGE_RE.exec(message);
  if (!m) return json({ status: "rejected", reason: "bad_format" }, 400);
  const [, binId, sentAt] = m;

  const sentMs = Date.parse(sentAt);
  if (Number.isNaN(sentMs) || Math.abs(Date.now() - sentMs) > MAX_SKEW_MS) {
    return json({ status: "rejected", reason: "stale_heartbeat" }, 400);
  }

  const { data: bin } = await supabase.from("bins").select("public_key").eq("id", binId).maybeSingle();
  if (!bin) return json({ status: "rejected", reason: "unknown_bin" }, 401);

  if (!(await verifyEd25519(bin.public_key as string, signature, message))) {
    return json({ status: "rejected", reason: "bad_signature" }, 401);
  }

  const { data, error } = await supabase.rpc("record_heartbeat", { p_bin_id: binId });
  if (error) {
    console.error("record_heartbeat failed", error.message);
    return json({ status: "rejected", reason: "internal_error" }, 500);
  }
  return json(data, (data as { status?: string })?.status === "ok" ? 200 : 400);
});
