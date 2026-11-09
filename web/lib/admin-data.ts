// Everything the Manage page lists, read as the admin (RLS lets an admin see every row, archived
// ones included). Scan counts decide what may be deleted or erased, so they are shown next to each record.
import type { Sb } from "./data"
import { serviceDb } from "./supabase"
import type { Category, Role } from "./shared"

export type AdminCompany = { id: string; name: string; is_demo: boolean; archived_at: string | null; created_at: string; scans: number; users: number; bins: number; products: number }
export type AdminProduct = { id: string; name: string; product_code: string; company_id: string; category: Category; unit_weight_g: number; approved: boolean; archived_at: string | null; scans: number }
export type AdminBin = { id: string; company_id: string; city: string; status: string; is_demo: boolean; archived_at: string | null; last_seen: string | null; scans: number }
export type AdminUser = { user_id: string; email: string; name: string; role: Role; company_id: string | null; assigned: string[]; last_sign_in_at: string | null }

export async function adminInventory(sb: Sb) {
  const [co, pr, bi, pf, aa, sc] = await Promise.all([
    sb.from("companies").select("id, name, is_demo, archived_at, created_at").order("name"),
    sb.from("products").select("id, name, product_code, company_id, category, unit_weight_g, approved, archived_at").order("name"),
    sb.from("bins").select("id, company_id, city, status, is_demo, archived_at, last_seen").order("id"),
    sb.from("profiles").select("user_id, role, company_id, full_name"),
    sb.from("auditor_assignments").select("auditor_id, company_id"),
    sb.rpc("admin_scan_counts"), // signed scans per company, bin and product in one grouped call (migration 20261109130000)
  ])
  for (const r of [co, pr, bi, pf, aa, sc]) if (r.error) throw new Error(`admin inventory: ${r.error.message}`)

  const scansOf = (kind: string) => new Map((sc.data ?? []).filter((r) => r.kind === kind).map((r) => [r.id, Number(r.scans)]))
  const byCompany = scansOf("company")
  const byBin = scansOf("bin")
  const byProduct = scansOf("product")

  // Emails live in Supabase Auth, which only the service role can list. The page is admin-only.
  const emails = new Map<string, { email: string; last_sign_in_at: string | null }>()
  try {
    const { data } = await serviceDb().auth.admin.listUsers({ perPage: 1000 })
    for (const u of data?.users ?? []) emails.set(u.id, { email: u.email ?? "", last_sign_in_at: u.last_sign_in_at ?? null })
  } catch {
    // without the service key the page still works; emails show as unknown
  }

  const profiles = pf.data ?? []
  const assignments = aa.data ?? []
  const companies: AdminCompany[] = (co.data ?? []).map((c) => ({
    ...c,
    scans: byCompany.get(c.id) ?? 0,
    users: profiles.filter((p) => p.company_id === c.id).length,
    bins: (bi.data ?? []).filter((b) => b.company_id === c.id).length,
    products: (pr.data ?? []).filter((p) => p.company_id === c.id).length,
  }))
  const products: AdminProduct[] = (pr.data ?? []).map((p) => ({ ...p, category: p.category as Category, unit_weight_g: Number(p.unit_weight_g), scans: byProduct.get(p.id) ?? 0 }))
  const bins: AdminBin[] = (bi.data ?? []).map((b) => ({ ...b, status: String(b.status), scans: byBin.get(b.id) ?? 0 }))
  const users: AdminUser[] = profiles
    .map((p) => ({
      user_id: p.user_id,
      email: emails.get(p.user_id)?.email ?? "",
      name: p.full_name ?? "",
      role: p.role as Role,
      company_id: p.company_id,
      assigned: assignments.filter((a) => a.auditor_id === p.user_id).map((a) => a.company_id),
      last_sign_in_at: emails.get(p.user_id)?.last_sign_in_at ?? null,
    }))
    .sort((a, b) => (a.email || a.name).localeCompare(b.email || b.name))
  return { companies, products, bins, users }
}
