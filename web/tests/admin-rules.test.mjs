import { test } from "node:test"
import assert from "node:assert/strict"
import { MANAGE_INTRO, binRules, companyRules, dbErrorMessage, nameMatches, productRules, userRules } from "../lib/admin-rules.ts"

test("a company with no scans and no users can be deleted", () => {
  const r = companyRules({ is_demo: false, archived: false, scans: 0, users: 0 })
  assert.equal(r.canDelete, true)
  assert.equal(r.deleteBlocked, null)
})

test("a company with signed scans is erased (scans and all), not plainly deleted", () => {
  const r = companyRules({ is_demo: false, archived: false, scans: 1477, users: 0 })
  assert.equal(r.canDelete, false)
  assert.equal(r.canErase, true)
  assert.equal(r.deleteBlocked, null)
  assert.equal(r.canArchive, true)
})

test("a company that still has users is erased too, which removes them", () => {
  const r = companyRules({ is_demo: false, archived: false, scans: 0, users: 2 })
  assert.equal(r.canDelete, false)
  assert.equal(r.canErase, true)
})

test("an empty company is deleted plainly, no erase needed", () => {
  assert.equal(companyRules({ is_demo: false, archived: false, scans: 0, users: 0 }).canErase, false)
})

test("the demo company can be neither erased nor deleted", () => {
  const r = companyRules({ is_demo: true, archived: false, scans: 40, users: 1 })
  assert.equal(r.canErase, false)
  assert.equal(r.canDelete, false)
})

test("the typed company name must match, ignoring extra spaces only", () => {
  assert.equal(nameMatches("  EcoFoods   India Ltd ", "EcoFoods India Ltd"), true)
  assert.equal(nameMatches("ecofoods india ltd", "EcoFoods India Ltd"), false)
  assert.equal(nameMatches("EcoFoods India", "EcoFoods India Ltd"), false)
  assert.equal(nameMatches("", "EcoFoods India Ltd"), false)
})

test("the demo company is protected from delete and archive", () => {
  const r = companyRules({ is_demo: true, archived: false, scans: 0, users: 0 })
  assert.equal(r.canDelete, false)
  assert.equal(r.canArchive, false)
  assert.match(r.deleteBlocked, /simulator/)
})

test("an archived company offers restore, not archive", () => {
  const r = companyRules({ is_demo: false, archived: true, scans: 5, users: 0 })
  assert.equal(r.canArchive, false)
  assert.equal(r.canRestore, true)
})

test("a scanned product can be archived but not deleted", () => {
  const r = productRules({ archived: false, scans: 1, approved: true })
  assert.equal(r.canDelete, false)
  assert.equal(r.deleteBlocked, "Has 1 signed scan. Archive it to retire it instead.")
  assert.equal(r.canArchive, true)
})

test("an unused product can be deleted", () => {
  assert.equal(productRules({ archived: false, scans: 0, approved: false }).canDelete, true)
})

test("bins: revoke an active bin, reactivate a revoked one, never delete one that reported", () => {
  assert.equal(binRules({ is_demo: false, archived: false, status: "active", scans: 0 }).statusAction, "revoke")
  assert.equal(binRules({ is_demo: false, archived: false, status: "revoked", scans: 0 }).statusAction, "reactivate")
  const reported = binRules({ is_demo: false, archived: false, status: "active", scans: 12 })
  assert.equal(reported.canDelete, false)
  assert.equal(reported.deleteBlocked, "Has 12 signed scans. Archive it to retire it instead.")
  assert.equal(binRules({ is_demo: true, archived: false, status: "active", scans: 0 }).canDelete, false)
})

test("an admin cannot change or remove their own account", () => {
  const self = userRules({ isSelf: true })
  assert.equal(self.canEdit, false)
  assert.equal(self.canDelete, false)
  assert.match(self.reason, /your own account/)
  assert.equal(userRules({ isSelf: false }).canDelete, true)
})

test("database refusals become plain sentences", () => {
  assert.equal(dbErrorMessage({ code: "23503" }), "It has signed scans, so it can't be deleted. Archive it instead.")
  assert.equal(dbErrorMessage({ code: "23514" }), "It still has users. Remove or move them first.")
  assert.equal(dbErrorMessage({ code: "23505" }), "That name or code is already in use.")
  assert.equal(dbErrorMessage({ code: "42501" }), "Only an admin can do that.")
  assert.equal(dbErrorMessage({ code: "22023" }), "Check the company name and the reason, then try again.")
  assert.equal(dbErrorMessage({ code: "XX000" }), "That didn't work. Try again.")
})

test("the Manage intro matches the rules: companies with scans can be erased, other scanned records only archived", () => {
  assert.doesNotMatch(MANAGE_INTRO, /Anything with signed scans can't be deleted/)
  assert.match(MANAGE_INTRO, /erase/i)
  assert.match(MANAGE_INTRO, /products and bins with signed scans can only be archived/i)
})
