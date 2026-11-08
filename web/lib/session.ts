// Who is logged in, which companies they may see, and the company/period scope of a page.
// Identity comes from Supabase Auth; role and company from public.profiles (A6).
import { cache } from "react"
import { redirect } from "next/navigation"
import { userDb } from "./supabase"
import { parsePeriod } from "./period"
import { READ_ONLY_ROLES, type Role } from "./shared"

export type Viewer = { id: string; email: string; name: string; role: Role; company_id: string | null }
export type CompanyRef = { id: string; name: string }

// cache(): layout and page share one lookup per request.
export const getSession = cache(async () => {
  const sb = await userDb()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null
  const { data: profile } = await sb.from("profiles").select("role, company_id, full_name").eq("user_id", user.id).maybeSingle()
  if (!profile) return { sb, user: null, companies: [] as CompanyRef[] }
  // RLS returns exactly the companies this user may see.
  // Archived companies only come back for admins (can_see_company); mark them in the name.
  const { data: rows } = await sb.from("companies").select("id, name, archived_at").eq("is_demo", false).order("name")
  const companies: CompanyRef[] = (rows ?? []).map((c) => ({ id: c.id, name: c.archived_at ? `${c.name} (archived)` : c.name }))
  const viewer: Viewer = {
    id: user.id,
    email: user.email ?? "",
    name: profile.full_name || user.email || "User",
    role: profile.role,
    company_id: profile.company_id,
  }
  return { sb, user: viewer, companies }
})

export async function requireSession() {
  const s = await getSession()
  if (!s) redirect("/login?next=/app/live")
  if (!s.user) redirect("/login?error=no_profile")
  return { sb: s.sb, user: s.user, companies: s.companies }
}

// companyId null = every company the caller can see (admin/regulator "All companies").
export function scopeFor(user: Viewer, companies: CompanyRef[], param?: string) {
  if (user.role === "company") {
    const own = companies.find((c) => c.id === user.company_id)
    return { companyId: user.company_id, current: user.company_id ?? "none", label: own?.name ?? "Your company" }
  }
  const picked = companies.find((c) => c.id === param)
  if (picked) return { companyId: picked.id, current: picked.id, label: picked.name }
  if (user.role === "auditor") {
    const first = companies[0]
    return { companyId: first?.id ?? null, current: first?.id ?? "none", label: first?.name ?? "No assigned companies" }
  }
  return { companyId: null, current: "all", label: "All companies" }
}

export function scopeOptions(user: Viewer, companies: CompanyRef[]) {
  return user.role === "regulator" || user.role === "admin" ? [{ id: "all", name: "All companies" }, ...companies] : companies
}

type SP = Promise<Record<string, string | string[] | undefined>>
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

// Everything a dashboard page needs: client, user, company scope, FY period, read-only flag.
export async function pageCtx(searchParams: SP) {
  const sp = await searchParams
  const s = await requireSession()
  const scope = scopeFor(s.user, s.companies, one(sp.company))
  const period = parsePeriod(one(sp.period))
  return { ...s, sp, scope, period, readOnly: READ_ONLY_ROLES.includes(s.user.role) }
}

// Keep ?company and ?period on in-app links.
export function href(path: string, sp: Record<string, string | string[] | undefined>, extra: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams()
  for (const k of ["company", "period"]) {
    const v = one(sp[k])
    if (v) q.set(k, v)
  }
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}
