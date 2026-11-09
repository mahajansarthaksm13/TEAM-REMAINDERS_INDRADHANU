import { NextResponse, type NextRequest } from "next/server"
import { serviceDb } from "@/lib/supabase"
import { callerIp, rateLimited } from "@/lib/demo-bin"
import { UUID_RE } from "@/lib/shared"

// A fresh one-time code for a demo product. This is the Studio's "reset": nothing is deleted,
// used codes simply stay used, exactly as on a real packet.
export async function POST(req: NextRequest) {
  if (rateLimited(callerIp(req))) return NextResponse.json({ reason: "rate_limited" }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const productId = typeof body?.product_id === "string" ? body.product_id : ""
  if (!UUID_RE.test(productId)) return NextResponse.json({ reason: "bad_product" }, { status: 400 })
  const { data, error } = await serviceDb().rpc("issue_demo_qr", { p_product_id: productId, p_quantity: 1 })
  if (error || !data?.[0]) return NextResponse.json({ reason: "not_a_demo_product" }, { status: 400 })
  return NextResponse.json({ code: data[0].qr_payload })
}
