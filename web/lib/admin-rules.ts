// What an admin may do with each record, and the plain reason when an action is blocked.
// The database enforces the same rules (migrations 20261109090000_admin_controls, 20261109120000_company_erasure); these let the
// Manage page explain them before the admin clicks. Tests: tests/admin-rules.test.mjs

type Rules = { canDelete: boolean; deleteBlocked: string | null; canArchive: boolean; canRestore: boolean }

// What the Manage page promises, kept beside the rules it describes (tested together).
export const MANAGE_INTRO =
  "Add, edit, hide or remove companies, products, bins and people. Archive hides a record from everyone except admins and keeps its history. A company with signed scans can be erased completely after you type its name, and every erasure is logged; products and bins with signed scans can only be archived, because they are evidence."

const n = (v: number) => v.toLocaleString("en-IN")
const scansWord = (v: number) => `${n(v)} signed scan${v === 1 ? "" : "s"}`

// A company with evidence or users is erased (erase_company, migration 20261109120000): scans,
// bins, products and users go with it, and the erasure is logged. An empty one is deleted plainly.
export function companyRules(c: { is_demo: boolean; archived: boolean; scans: number; users: number }): Rules & { canErase: boolean } {
  const hasData = c.scans > 0 || c.users > 0
  return {
    canDelete: !c.is_demo && !hasData,
    canErase: !c.is_demo && hasData,
    deleteBlocked: c.is_demo ? "The demo company runs the website's simulator." : null,
    canArchive: !c.archived && !c.is_demo,
    canRestore: c.archived,
  }
}

// The erase dialog asks for the company's exact name; only spacing may differ (same as the database).
const squash = (v: string) => v.replace(/\s+/g, " ").trim()
export function nameMatches(typed: string, name: string): boolean {
  return squash(typed) !== "" && squash(typed) === squash(name)
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
    case "22023":
      return "Check the company name and the reason, then try again."
    default:
      return "That didn't work. Try again."
  }
}
