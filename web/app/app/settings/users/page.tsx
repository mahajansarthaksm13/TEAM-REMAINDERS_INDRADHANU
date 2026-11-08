import type { Metadata } from "next"
import { Badge, Card, CardHead, DataTable, EmptyState, PageHeader } from "@/components/vb/ui"
import { InviteDialog } from "@/components/vb/invite-dialog"
import { serviceDb } from "@/lib/supabase"
import { pageCtx } from "@/lib/session"
import { ROLE_LABEL, type Role } from "@/lib/shared"
import { fmtDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Users" }

type Row = { id: string; email: string; name: string; role: Role; company: string; status: "active" | "invited"; at: string | null }

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, user, companies } = await pageCtx(searchParams)
  if (user.role !== "admin") return <><PageHeader title="Users" /><EmptyState>Only admins can manage users.</EmptyState></>
  // Profiles and assignments through RLS (admin reads all); emails need the auth admin API (service role).
  const [{ data: profiles }, { data: assignments }, list] = await Promise.all([
    sb.from("profiles").select("user_id, role, company_id, full_name"),
    sb.from("auditor_assignments").select("auditor_id, company_id"),
    serviceDb().auth.admin.listUsers({ perPage: 1000 }),
  ])
  const name = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "—"
  const authUsers = new Map((list.data?.users ?? []).map((u) => [u.id, u]))
  const rows: Row[] = (profiles ?? []).map((p) => {
    const u = authUsers.get(p.user_id)
    const assigned = (assignments ?? []).filter((a) => a.auditor_id === p.user_id).map((a) => name(a.company_id))
    return {
      id: p.user_id,
      email: u?.email ?? "—",
      name: p.full_name ?? "—",
      role: p.role,
      company: p.role === "company" ? name(p.company_id) : p.role === "auditor" ? assigned.join(", ") || "None assigned" : "All",
      status: u?.last_sign_in_at ? "active" : "invited",
      at: u?.invited_at ?? u?.created_at ?? null,
    }
  })
  return (
    <>
      <PageHeader title="Users" desc="Public sign-up is off. Invited people get an email to set their password." actions={<InviteDialog companies={companies} />} />
      <Card>
        <CardHead eyebrow="Accounts" title={`${rows.length} people`} />
        <DataTable<Row>
          caption="Users and invites"
          rows={rows}
          rowKey={(r) => r.id}
          title={(r) => r.email}
          cols={[
            { key: "email", label: "Email", cell: (r) => <span className="font-semibold">{r.email}</span>, hideMobile: true },
            { key: "name", label: "Name", cell: (r) => r.name },
            { key: "role", label: "Role", cell: (r) => ROLE_LABEL[r.role] },
            { key: "co", label: "Company", cell: (r) => r.company },
            { key: "st", label: "Status", cell: (r) => (r.status === "invited" ? <Badge kind="pending" className="whitespace-nowrap">Invited {r.at && fmtDateTime(r.at)}</Badge> : <Badge kind="ok">Active</Badge>) },
          ]}
        />
      </Card>
    </>
  )
}
