import { test } from "node:test"
import assert from "node:assert/strict"
import { isEmail, normalizeEmail } from "../lib/validate.ts"

test("an email pasted with spaces or capitals is accepted after normalising (as the server does)", () => {
  const raw = "  Priya.Sharma@EcoFoods.in "
  assert.equal(normalizeEmail(raw), "priya.sharma@ecofoods.in")
  assert.equal(isEmail(normalizeEmail(raw)), true)
})

test("isEmail rejects addresses the server would reject", () => {
  for (const bad of ["", "priya", "priya@", "@ecofoods.in", "priya@ecofoods", "pri ya@ecofoods.in"]) assert.equal(isEmail(bad), false, bad)
})
