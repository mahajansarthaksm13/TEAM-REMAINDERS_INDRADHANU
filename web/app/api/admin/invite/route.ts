import { NextResponse, type NextRequest } from "next/server"
import { serviceDb } from "@/lib/supabase"
import { getSession } from "@/lib/session"
import { ROLE_LABEL, UUID_RE, type Role } from "@/lib/shared"

// Spec B8: POST /api/admin/invite { email, role, company_id? }. The service role is used only
// after the caller is confirmed to be an admin, and only here on the server.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s?.user || s.user.role !== "admin") return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 })
  const b = await req.json().catch(() => null)
  const email = String(b?.email ?? "").trim().toLowerCase()
  const role = b?.role as Role
  const companyId = b?.company_id ? String(b.company_id) : null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !(role in ROLE_LABEL)) return NextResponse.json({ code: "INVALID" }, { status: 422 })
  if ((role === "company" || role === "auditor") && !(companyId && UUID_RE.test(companyId) && s.companies.some((c) => c.id === companyId)))
    return NextResponse.json({ code: "INVALID" }, { status: 422 })

  const admin = serviceDb()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${req.nextUrl.origin}/set-password` })
  if (error) return NextResponse.json({ code: error.code === "email_exists" || error.status === 422 ? "EXISTS" : "FAILED" }, { status: error.status === 422 ? 409 : 500 })

  const userId = data.user.id
  const { error: pErr } = await admin.from("profiles").insert({ user_id: userId, role, company_id: role === "company" ? companyId : null, full_name: null })
  if (!pErr && role === "auditor") await admin.from("auditor_assignments").insert({ auditor_id: userId, company_id: companyId! })
  if (pErr) {
    await admin.auth.admin.deleteUser(userId) // no half-created account without a profile
    return NextResponse.json({ code: "FAILED" }, { status: 500 })
  }
  return NextResponse.json({ user_id: userId }, { status: 201 })
}
