"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { userDb } from "./supabase"
import { getSession } from "./session"
import { parsePeriod } from "./period"
import { isCategory } from "./shared"

export type LoginState = { error?: string; email?: string }

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim()
  const password = String(form.get("password") ?? "")
  const next = String(form.get("next") ?? "")
  if (!email || !password) return { error: "Enter your email and password.", email }
  const sb = await userDb()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.status === 400 || error.code === "invalid_credentials") return { error: "Email or password is incorrect.", email }
    return { error: "Couldn't reach the server. Try again.", email }
  }
  const { data: profile } = await sb.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle()
  if (!profile) {
    await sb.auth.signOut()
    return { error: "Your account isn't set up yet. Contact your admin.", email }
  }
  redirect(next.startsWith("/app") ? next : "/app/live")
}

export async function logout() {
  const sb = await userDb()
  await sb.auth.signOut()
  redirect("/login")
}

// A12: companies and admins close alerts they can see (RLS policy alerts_close).
export async function closeAlert(id: string) {
  const sb = await userDb()
  const { error } = await sb.from("alerts").update({ closed_at: new Date().toISOString() }).eq("id", id)
  return error ? { error: error.message } : { ok: true }
}

export async function previewReport(category: string, periodKey: string) {
  const s = await getSession()
  if (!s?.user || s.user.role !== "company") return { error: "Only company users can generate reports." }
  if (!isCategory(category)) return { error: "Pick a category." }
  const p = parsePeriod(periodKey)
  const { data, error } = await s.sb.rpc("get_report_snapshot", { p_category: category, p_from: p.from, p_to: p.to })
  if (error) {
    if (error.message.includes("no checkpoint")) return { snapshot: null, period: p, note: "No checkpoint has been made yet. The first one is created at 00:05 IST." }
    return { error: "Preview couldn't run. Try again." }
  }
  const row = data?.[0]
  const snapshot =
    row && Number(row.scan_count) > 0
      ? {
          scan_count: Number(row.scan_count),
          qr_kg: Number(row.qr_kg),
          barcode_kg: Number(row.barcode_kg),
          under_review_count: Number(row.under_review_count),
          checkpoint_day: row.checkpoint_day,
          checkpoint_hash: row.checkpoint_hash,
          fingerprint: row.fingerprint,
        }
      : null
  return { snapshot, period: p }
}

export async function runVerifyChain(binId: string) {
  const sb = await userDb()
  const { data, error } = await sb.rpc("verify_chain", { p_bin_id: binId })
  if (error || !data?.[0]) return { error: "Verification couldn't run." }
  return { result: data[0] }
}

export type ProductState = { ok?: boolean; error?: string; fields?: Record<string, string> }

// A11: the database assigns product_code and forces approved = false (products_guard).
export async function createProduct(_: ProductState, form: FormData): Promise<ProductState> {
  const s = await getSession()
  if (!s?.user || s.user.role !== "company" || !s.user.company_id) return { error: "Only company users can add products." }
  const name = String(form.get("name") ?? "").trim()
  const barcode = String(form.get("barcode") ?? "").trim()
  const category = String(form.get("category") ?? "")
  const w = String(form.get("weight") ?? "").trim()
  const fields: Record<string, string> = {}
  if (!name) fields.name = "Enter a product name."
  if (!/^\d{8,14}$/.test(barcode)) fields.barcode = "Barcode must be 8–14 digits."
  if (!isCategory(category)) fields.category = "Pick a category."
  if (!/^\d+$/.test(w) || +w <= 0) fields.weight = "Weight must be positive whole grams."
  if (Object.keys(fields).length) return { fields }
  // ponytail: only sees products the caller can read (RLS); the table has no unique constraint on barcode.
  const { count } = await s.sb.from("products").select("id", { count: "exact", head: true }).eq("barcode", barcode)
  if (count) return { fields: { barcode: "This barcode already exists." } }
  const { error } = await s.sb.from("products").insert({ company_id: s.user.company_id, name, barcode, category: category as never, unit_weight_g: +w })
  if (error) return { error: "Product couldn't be saved. Try again." }
  revalidatePath("/app/catalogue")
  return { ok: true }
}

// A11: issue_qr_codes returns one row per code (capped at 1000 by PostgREST) with the batch id;
// the full batch is read back by batch id (CSV route, print sheet).
export async function issueQr(productId: string, quantity: number) {
  const s = await getSession()
  if (!s?.user || s.user.role !== "company") return { error: "This product can't issue codes." }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return { error: "Quantity must be a whole number from 1 to 10,000." }
  const { data, error } = await s.sb.rpc("issue_qr_codes", { p_product_id: productId, p_quantity: quantity })
  if (error) return { error: error.code === "42501" || error.code === "P0001" ? "This product can't issue codes." : "Codes couldn't be issued. Nothing was saved." }
  revalidatePath("/app/catalogue/qr")
  return { batch_id: data?.[0]?.batch_id as string, count: quantity }
}

export async function approve(id: string) {
  const s = await getSession()
  if (!s?.user || s.user.role !== "admin") return { error: "Only admins can approve products." }
  const { data, error } = await s.sb.from("products").update({ approved: true }).eq("id", id).select("id")
  if (error || !data?.length) return { error: "Couldn't approve this product." }
  revalidatePath("/app/catalogue/approvals")
  return { ok: true }
}
