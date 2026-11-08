"use server"

// Admin-only changes. Every action re-checks the caller is an admin, writes as that admin (the RLS
// policies in migration 20261109090000_admin_controls decide what is allowed), and treats "no row
// changed" as a refusal. Deleting a person's sign-in needs the service role, after the same check.
import { revalidatePath } from "next/cache"
import { getSession } from "./session"
import { serviceDb } from "./supabase"
import { dbErrorMessage } from "./admin-rules"
import { ROLE_LABEL, UUID_RE, type Role } from "./shared"

export type AdminResult = { ok: true; message: string } | { ok: false; error: string }

async function admin() {
  const s = await getSession()
  return s?.user && s.user.role === "admin" ? s : null
}
const denied: AdminResult = { ok: false, error: "Only an admin can do that." }
const done = (message: string): AdminResult => {
  revalidatePath("/app", "layout") // every dashboard page reflects the change
  return { ok: true, message }
}
// Run a write that returns the changed rows; RLS filtering a row out counts as a refusal.
async function changed(q: PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }>, ok: string): Promise<AdminResult> {
  const { data, error } = await q
  if (error) return { ok: false, error: dbErrorMessage(error) }
  if (!data?.length) return { ok: false, error: "Nothing changed. It may have been removed already, or it is protected." }
  return done(ok)
}
const cleanName = (raw: string) => raw.replace(/\s+/g, " ").trim()

// ── Companies ──────────────────────────────────────────────────
export async function createCompany(rawName: string): Promise<AdminResult> {
  const s = await admin()
  if (!s) return denied
  const name = cleanName(rawName)
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Use a name between 2 and 120 characters." }
  return changed(s.sb.from("companies").insert({ name }).select("id"), `${name} added.`)
}
export async function renameCompany(id: string, rawName: string): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(id)) return denied
  const name = cleanName(rawName)
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Use a name between 2 and 120 characters." }
  return changed(s.sb.from("companies").update({ name }).eq("id", id).select("id"), `Renamed to ${name}.`)
}
export async function setCompanyArchived(id: string, archived: boolean): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(id)) return denied
  return changed(
    s.sb.from("companies").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).eq("is_demo", false).select("id"),
    archived ? "Company archived: hidden from everyone except admins." : "Company restored: visible again."
  )
}
export async function deleteCompany(id: string): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(id)) return denied
  return changed(s.sb.from("companies").delete().eq("id", id).select("id"), "Company deleted.")
}

// ── Products ───────────────────────────────────────────────────
export async function setProductArchived(id: string, archived: boolean): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(id)) return denied
  return changed(s.sb.from("products").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id"), archived ? "Product archived." : "Product restored.")
}
export async function setProductApproved(id: string, approved: boolean): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(id)) return denied
  return changed(s.sb.from("products").update({ approved }).eq("id", id).select("id"), approved ? "Product approved." : "Approval withdrawn: new scans of it will be refused.")
}
export async function deleteProduct(id: string): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(id)) return denied
  return changed(s.sb.from("products").delete().eq("id", id).select("id"), "Product deleted.")
}

// ── Bins ───────────────────────────────────────────────────────
const BIN_RE = /^VB-[A-Z]{3}-\d{4}(-DEMO)?$/
export async function setBinStatus(id: string, status: "active" | "revoked"): Promise<AdminResult> {
  const s = await admin()
  if (!s || !BIN_RE.test(id) || (status !== "active" && status !== "revoked")) return denied
  return changed(s.sb.from("bins").update({ status }).eq("id", id).select("id"), status === "revoked" ? `${id} revoked: it can no longer submit scans.` : `${id} reactivated.`)
}
export async function setBinArchived(id: string, archived: boolean): Promise<AdminResult> {
  const s = await admin()
  if (!s || !BIN_RE.test(id)) return denied
  return changed(s.sb.from("bins").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).eq("is_demo", false).select("id"), archived ? `${id} archived.` : `${id} restored.`)
}
export async function deleteBin(id: string): Promise<AdminResult> {
  const s = await admin()
  if (!s || !BIN_RE.test(id)) return denied
  return changed(s.sb.from("bins").delete().eq("id", id).select("id"), `${id} deleted.`)
}

// ── People ─────────────────────────────────────────────────────
export async function setUserAccess(userId: string, role: Role, companyId: string | null): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(userId) || !(role in ROLE_LABEL)) return denied
  if (userId === s.user!.id) return { ok: false, error: "You can't change your own access. Ask another admin." }
  if (role === "company" && !(companyId && UUID_RE.test(companyId))) return { ok: false, error: "Pick the company this user belongs to." }
  return changed(
    s.sb.from("profiles").update({ role, company_id: role === "company" ? companyId : null }).eq("user_id", userId).select("user_id"),
    `Access updated: ${ROLE_LABEL[role]}.`
  )
}
export async function setAuditorAssignment(auditorId: string, companyId: string, assigned: boolean): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(auditorId) || !UUID_RE.test(companyId)) return denied
  return assigned
    ? changed(s.sb.from("auditor_assignments").insert({ auditor_id: auditorId, company_id: companyId }).select("auditor_id"), "Company assigned.")
    : changed(s.sb.from("auditor_assignments").delete().eq("auditor_id", auditorId).eq("company_id", companyId).select("auditor_id"), "Assignment removed.")
}
export async function removeUser(userId: string): Promise<AdminResult> {
  const s = await admin()
  if (!s || !UUID_RE.test(userId)) return denied
  if (userId === s.user!.id) return { ok: false, error: "You can't remove your own account. Ask another admin." }
  // Removing the sign-in also removes the profile (on delete cascade). Their past actions stay in the ledger.
  try {
    const { error } = await serviceDb().auth.admin.deleteUser(userId)
    if (error) return { ok: false, error: "Couldn't remove this user. Try again." }
  } catch {
    return { ok: false, error: "Removing users needs the server's service key, which isn't set." }
  }
  return done("User removed. They can no longer sign in.")
}
