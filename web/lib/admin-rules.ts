// What an admin may do with each record, and the plain reason when an action is blocked.
// The database enforces the same rules (migration 20261109090000_admin_controls); these let the
// Manage page explain them before the admin clicks. Tests: tests/admin-rules.test.mjs

type Rules = { canDelete: boolean; deleteBlocked: string | null; canArchive: boolean; canRestore: boolean }

const n = (v: number) => v.toLocaleString("en-IN")
const scansWord = (v: number) => `${n(v)} signed scan${v === 1 ? "" : "s"}`

export function companyRules(c: { is_demo: boolean; archived: boolean; scans: number; users: number }): Rules {
  const deleteBlocked = c.is_demo
    ? "The demo company runs the website's simulator."
    : c.scans > 0
      ? `Has ${scansWord(c.scans)}. Archive it to hide it instead.`
      : c.users > 0
        ? `Has ${n(c.users)} user${c.users === 1 ? "" : "s"}. Remove or move them first.`
        : null
  return { canDelete: deleteBlocked === null, deleteBlocked, canArchive: !c.archived && !c.is_demo, canRestore: c.archived }
}

export function productRules(p: { archived: boolean; scans: number; approved: boolean }): Rules {
  const deleteBlocked = p.scans > 0 ? `Has ${scansWord(p.scans)}. Archive it to retire it instead.` : null
  return { canDelete: deleteBlocked === null, deleteBlocked, canArchive: !p.archived, canRestore: p.archived }
}

export function binRules(b: { is_demo: boolean; archived: boolean; status: string; scans: number }): Rules & { statusAction: "revoke" | "reactivate" } {
  const deleteBlocked = b.is_demo
    ? "Demo bins run the website's simulator."
    : b.scans > 0
      ? `Has ${scansWord(b.scans)}. Archive it to retire it instead.`
      : null
  return {
    canDelete: deleteBlocked === null,
    deleteBlocked,
    canArchive: !b.archived && !b.is_demo,
    canRestore: b.archived,
    statusAction: b.status === "active" ? "revoke" : "reactivate",
  }
}

export function userRules(u: { isSelf: boolean }): { canEdit: boolean; canDelete: boolean; reason: string | null } {
  return u.isSelf
    ? { canEdit: false, canDelete: false, reason: "This is your own account. Another admin has to change it, so you can't lock yourself out." }
    : { canEdit: true, canDelete: true, reason: null }
}

// Postgres refusals (via PostgREST) as sentences an admin can act on.
export function dbErrorMessage(e: { code?: string } | null | undefined): string {
  switch (e?.code) {
    case "23503":
      return "It has signed scans, so it can't be deleted. Archive it instead."
    case "23514":
      return "It still has users. Remove or move them first."
    case "23505":
      return "That name or code is already in use."
    case "42501":
      return "Only an admin can do that."
    default:
      return "That didn't work. Try again."
  }
}
