import Link from "next/link"
import type { Metadata } from "next"
import { cn } from "cn"
import { Badge, Card, CardHead, CategorySwatch, DataTable, EmptyState, Notice, PageHeader } from "@/components/vb/ui"
import { AdminButton, AuditorAssignments, CreateCompanyForm, RenameCompany, UserAccess } from "@/components/vb/admin-controls"
import { InviteDialog } from "@/components/vb/invite-dialog"
import { adminInventory } from "@/lib/admin-data"
import { binRules, companyRules, productRules, userRules } from "@/lib/admin-rules"
import {
  deleteBin,
  deleteCompany,
  deleteProduct,
  removeUser,
  setBinArchived,
  setBinStatus,
  setCompanyArchived,
  setProductApproved,
  setProductArchived,
} from "@/lib/admin-actions"
import { href, one, pageCtx } from "@/lib/session"
import { num, timeAgo } from "@/lib/format"
import { CATEGORY_LABEL, ROLE_LABEL, cityName } from "@/lib/shared"

export const metadata: Metadata = { title: "Manage" }

const TABS = [
  ["companies", "Companies"],
  ["products", "Products"],
  ["bins", "Bins"],
  ["people", "People"],
] as const
type Tab = (typeof TABS)[number][0]
type Show = "active" | "archived" | "all"

// The admin's control room: decide what exists on the platform and what is visible.
// Archive hides a record from everyone but admins and keeps its history; delete is offered only
// where nothing was ever signed against the record (the database enforces the same rule).
export default async function ManagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, user, sp } = await pageCtx(searchParams)
  if (user.role !== "admin") return <><PageHeader title="Manage" /><EmptyState>Only admins can manage companies, products, bins and people.</EmptyState></>

  const tab: Tab = TABS.some(([t]) => t === one(sp.tab)) ? (one(sp.tab) as Tab) : "companies"
  const show: Show = one(sp.show) === "archived" || one(sp.show) === "all" ? (one(sp.show) as Show) : "active"
  const inv = await adminInventory(sb)
  const coName = new Map(inv.companies.map((c) => [c.id, c.name]))
  const activeCompanies = inv.companies.filter((c) => !c.archived_at && !c.is_demo).map((c) => ({ id: c.id, name: c.name }))
  const keep = (archived: string | null) => (show === "all" ? true : show === "archived" ? !!archived : !archived)
  const link = (extra: Record<string, string | undefined>) => href("/app/admin", sp, { tab, show, ...extra })

  const counts: Record<Tab, { active: number; archived: number }> = {
    companies: { active: inv.companies.filter((c) => !c.archived_at).length, archived: inv.companies.filter((c) => c.archived_at).length },
    products: { active: inv.products.filter((p) => !p.archived_at).length, archived: inv.products.filter((p) => p.archived_at).length },
    bins: { active: inv.bins.filter((b) => !b.archived_at).length, archived: inv.bins.filter((b) => b.archived_at).length },
    people: { active: inv.users.length, archived: 0 },
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Manage the platform"
        desc="Add, edit, hide or remove companies, products, bins and people. Archive hides a record from everyone except admins and keeps its history. Anything with signed scans can't be deleted, because it is evidence."
      />

      {/* Tabs: deep-linkable, so an admin can share "the bins list, archived only". */}
      <nav aria-label="What to manage" className="neu-pill mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={href("/app/admin", sp, { tab: t, show: t === "people" ? undefined : show })}
            aria-current={t === tab ? "page" : undefined}
            className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors", t === tab ? "btn-lit text-snow" : "text-dim hover:text-ink")}
          >
            {label}
            <span className={cn("tnum rounded-full px-1.5 text-xs", t === tab ? "bg-snow/20" : "bg-chip")}>{counts[t].active + counts[t].archived}</span>
          </Link>
        ))}
      </nav>

      {tab !== "people" && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
          {(["active", "archived", "all"] as Show[]).map((s) => (
            <Link key={s} href={link({ show: s })} aria-current={s === show ? "true" : undefined} className={cn("inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold", s === show ? "neu-press text-ink" : "text-dim hover:text-ink")}>
              {s === "active" ? `Visible (${counts[tab].active})` : s === "archived" ? `Archived (${counts[tab].archived})` : "All"}
            </Link>
          ))}
        </div>
      )}

      {tab === "companies" && (
        <Card>
          <CardHead eyebrow="Companies" title="Who is on the platform" />
          <div className="mb-6"><CreateCompanyForm /></div>
          <DataTable
            rows={inv.companies.filter((c) => keep(c.archived_at))}
            rowKey={(c) => c.id}
            title={(c) => c.name}
            caption="Companies"
            cols={[
              { key: "name", label: "Company", cell: (c) => (
                <span className="flex flex-wrap items-center gap-2">
                  <RenameCompany id={c.id} name={c.name} archived={!!c.archived_at} />
                  {c.archived_at && <Badge kind="warning">Archived</Badge>}
                  {c.is_demo && <Badge kind="neutral">Demo</Badge>}
                </span>
              ) },
              { key: "scans", label: "Signed scans", align: "right", cell: (c) => num(c.scans) },
              { key: "users", label: "Users", align: "right", cell: (c) => num(c.users) },
              { key: "bins", label: "Bins", align: "right", cell: (c) => num(c.bins) },
              { key: "products", label: "Products", align: "right", cell: (c) => num(c.products) },
              { key: "act", label: "Actions", cell: (c) => {
                const r = companyRules({ is_demo: c.is_demo, archived: !!c.archived_at, scans: c.scans, users: c.users })
                return (
                  <span className="flex flex-wrap gap-2">
                    {r.canRestore && <AdminButton action={setCompanyArchived.bind(null, c.id, false)} label="Restore" />}
                    {r.canArchive && <AdminButton action={setCompanyArchived.bind(null, c.id, true)} label="Archive" confirmLabel="Yes, hide it" />}
                    <AdminButton action={deleteCompany.bind(null, c.id)} label="Delete" confirmLabel="Yes, delete" tone="danger" blocked={r.deleteBlocked} />
                  </span>
                )
              } },
            ]}
          />
          <p className="mt-4 text-xs text-dim">Archived companies disappear for their own users, auditors and regulators, and leave public totals; admins still see them, marked Archived. Hover a greyed-out Delete to see why it is blocked.</p>
        </Card>
      )}

      {tab === "products" && (
        <Card>
          <CardHead eyebrow="Products" title="The catalogue, across every company" />
          <DataTable
            rows={inv.products.filter((p) => keep(p.archived_at))}
            rowKey={(p) => p.id}
            title={(p) => p.name}
            caption="Products"
            cols={[
              { key: "name", label: "Product", cell: (p) => (
                <span className="flex flex-col">
                  <span className={cn("font-semibold", p.archived_at && "text-dim")}>{p.name}</span>
                  <span className="font-mono text-xs text-dim">{p.product_code} · {p.unit_weight_g} g</span>
                </span>
              ) },
              { key: "company", label: "Company", cell: (p) => coName.get(p.company_id) ?? "—" },
              { key: "cat", label: "Category", cell: (p) => <span className="inline-flex items-center gap-2"><CategorySwatch category={p.category} />{CATEGORY_LABEL[p.category]}</span> },
              { key: "status", label: "Status", cell: (p) => (
                <span className="flex flex-wrap gap-1.5">
                  {p.approved ? <Badge kind="approved">✓ Approved</Badge> : <Badge kind="pending">Waiting for approval</Badge>}
                  {p.archived_at && <Badge kind="warning">Archived</Badge>}
                </span>
              ) },
              { key: "scans", label: "Signed scans", align: "right", cell: (p) => num(p.scans) },
              { key: "act", label: "Actions", cell: (p) => {
                const r = productRules({ archived: !!p.archived_at, scans: p.scans, approved: p.approved })
                return (
                  <span className="flex flex-wrap gap-2">
                    {p.approved
                      ? <AdminButton action={setProductApproved.bind(null, p.id, false)} label="Withdraw approval" confirmLabel="Yes, withdraw" />
                      : <AdminButton action={setProductApproved.bind(null, p.id, true)} label="Approve" />}
                    {r.canRestore && <AdminButton action={setProductArchived.bind(null, p.id, false)} label="Restore" />}
                    {r.canArchive && <AdminButton action={setProductArchived.bind(null, p.id, true)} label="Archive" />}
                    <AdminButton action={deleteProduct.bind(null, p.id)} label="Delete" confirmLabel="Yes, delete" tone="danger" blocked={r.deleteBlocked} />
                  </span>
                )
              } },
            ]}
          />
          <p className="mt-4 text-xs text-dim">Withdrawing approval makes bins refuse new scans of the product. Archiving takes it out of the catalogue and the QR issuer; its past scans stay readable.</p>
        </Card>
      )}

      {tab === "bins" && (
        <Card>
          <CardHead eyebrow="Bins" title="Every collection point" />
          <DataTable
            rows={inv.bins.filter((b) => keep(b.archived_at))}
            rowKey={(b) => b.id}
            title={(b) => b.id}
            caption="Bins"
            cols={[
              { key: "id", label: "Bin", cell: (b) => <span className={cn("font-mono font-semibold whitespace-nowrap", b.archived_at && "text-dim")}>{b.id}</span> },
              { key: "company", label: "Company", cell: (b) => coName.get(b.company_id) ?? "—" },
              { key: "city", label: "City", cell: (b) => cityName(b.city) },
              { key: "status", label: "Status", cell: (b) => (
                <span className="flex flex-wrap gap-1.5">
                  {b.status === "active" ? <Badge kind="ok">✓ Active</Badge> : <Badge kind="error">✗ Revoked</Badge>}
                  {b.archived_at && <Badge kind="warning">Archived</Badge>}
                  {b.is_demo && <Badge kind="neutral">Demo</Badge>}
                </span>
              ) },
              { key: "seen", label: "Last report", cell: (b) => (b.last_seen ? timeAgo(b.last_seen) : "Never") },
              { key: "scans", label: "Signed scans", align: "right", cell: (b) => num(b.scans) },
              { key: "act", label: "Actions", cell: (b) => {
                const r = binRules({ is_demo: b.is_demo, archived: !!b.archived_at, status: b.status, scans: b.scans })
                return (
                  <span className="flex flex-wrap gap-2">
                    {r.statusAction === "revoke"
                      ? <AdminButton action={setBinStatus.bind(null, b.id, "revoked")} label="Revoke" confirmLabel="Yes, revoke" />
                      : <AdminButton action={setBinStatus.bind(null, b.id, "active")} label="Reactivate" />}
                    {r.canRestore && <AdminButton action={setBinArchived.bind(null, b.id, false)} label="Restore" />}
                    {r.canArchive && <AdminButton action={setBinArchived.bind(null, b.id, true)} label="Archive" />}
                    <AdminButton action={deleteBin.bind(null, b.id)} label="Delete" confirmLabel="Yes, delete" tone="danger" blocked={r.deleteBlocked} />
                  </span>
                )
              } },
            ]}
          />
          <p className="mt-4 text-xs text-dim">Revoking a bin makes the ledger refuse anything it sends from now on. Archiving takes it out of bin lists and public counts; its signed history stays.</p>
        </Card>
      )}

      {tab === "people" && (
        <Card>
          <CardHead eyebrow="People" title="Who can sign in, and what they see" action={<InviteDialog companies={activeCompanies} />} />
          {inv.users.some((u) => !u.email) && <div className="mb-4"><Notice kind="info">Emails show once the server&apos;s service key is set.</Notice></div>}
          <DataTable
            rows={inv.users}
            rowKey={(u) => u.user_id}
            title={(u) => u.email || u.name}
            caption="People"
            cols={[
              { key: "who", label: "Person", cell: (u) => (
                <span className="flex flex-col">
                  <span className="font-semibold">{u.email || u.name || "Unknown"}</span>
                  <span className="text-xs text-dim">{u.name}{u.last_sign_in_at ? ` · last signed in ${timeAgo(u.last_sign_in_at)}` : " · never signed in"}</span>
                </span>
              ) },
              { key: "role", label: "Role and company", cell: (u) => (
                <UserAccess userId={u.user_id} role={u.role} companyId={u.company_id} companies={activeCompanies} isSelf={u.user_id === user.id} />
              ) },
              { key: "scope", label: "Sees", cell: (u) =>
                u.role === "auditor" ? (
                  <AuditorAssignments auditorId={u.user_id} assigned={u.assigned} companies={activeCompanies} />
                ) : u.role === "company" ? (
                  coName.get(u.company_id ?? "") ?? "—"
                ) : (
                  `Every company (${ROLE_LABEL[u.role]})`
                ) },
              { key: "act", label: "Actions", cell: (u) => {
                const r = userRules({ isSelf: u.user_id === user.id })
                return <AdminButton action={removeUser.bind(null, u.user_id)} label="Remove" confirmLabel="Yes, remove" tone="danger" blocked={r.canDelete ? null : r.reason} />
              } },
            ]}
          />
          <p className="mt-4 text-xs text-dim">Removing a person deletes their sign-in; everything they recorded stays in the ledger. Auditors only see the companies ticked for them.</p>
        </Card>
      )}
    </>
  )
}
