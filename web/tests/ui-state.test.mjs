import { test } from "node:test"
import assert from "node:assert/strict"
import { forSelection, mergeFeed, pickOr, selectionKey, toggleHidden, visibleItems } from "../lib/ui-state.ts"

// Report preview: a result is only valid for the category + period it was requested for.
test("a preview result applies only to the selection that requested it", () => {
  const result = { key: selectionKey("cat1_rigid", "FY2026"), snapshot: { scan_count: 10 } }
  assert.equal(forSelection(result, selectionKey("cat1_rigid", "FY2026")), result)
  assert.equal(forSelection(result, selectionKey("cat2_flexible", "FY2026")), undefined) // category changed mid-flight
  assert.equal(forSelection(result, selectionKey("cat1_rigid", "FY2026-Q2")), undefined) // period changed mid-flight
  assert.equal(forSelection(undefined, selectionKey("cat1_rigid", "FY2026")), undefined)
})

// Chart filters remember what the user HID, not what was shown, so data that appears later
// (another period, another company) is visible by default instead of silently filtered out.
test("an item that appears after a filter change is visible", () => {
  const hidden = toggleHidden(["cat1", "cat4"], [], "cat4") // user hides cat4
  assert.deepEqual(visibleItems(["cat1", "cat2", "cat4"], hidden), ["cat1", "cat2"]) // new period brings cat2
})

test("the last visible item cannot be hidden", () => {
  const hidden = toggleHidden(["a", "b"], ["a"], "b")
  assert.deepEqual(hidden, ["a"])
  assert.deepEqual(visibleItems(["a", "b"], hidden), ["b"])
})

test("hiding everything that is still available falls back to showing all", () => {
  // e.g. the only categories left in a new period were all hidden earlier
  assert.deepEqual(visibleItems(["a", "b"], ["a", "b", "c"]), ["a", "b"])
})

test("toggling a hidden item shows it again", () => {
  assert.deepEqual(toggleHidden(["a", "b"], ["a"], "a"), [])
})

test("pickOr keeps a valid choice and replaces a stale one", () => {
  assert.equal(pickOr("PUN", ["all", "PUN", "MUM"], "all"), "PUN")
  assert.equal(pickOr("NAG", ["all", "PUN", "MUM"], "all"), "all") // NAG gone after a scope change
})

const row = (id, at) => ({ scan_id: id, received_at: at })

test("mergeFeed adds rows from a server refresh to the live list", () => {
  const live = [row("b", "2026-11-08T10:01:00Z"), row("a", "2026-11-08T10:00:00Z")]
  const refreshed = [row("c", "2026-11-08T10:02:00Z"), row("b", "2026-11-08T10:01:00Z")]
  assert.deepEqual(mergeFeed(refreshed, live).map((r) => r.scan_id), ["c", "b", "a"])
})

test("mergeFeed keeps the newest rows first and caps the list", () => {
  const many = Array.from({ length: 60 }, (_, i) => row(`s${i}`, new Date(Date.UTC(2026, 10, 8, 10, i)).toISOString()))
  const out = mergeFeed(many.slice(0, 30), many.slice(30), 50)
  assert.equal(out.length, 50)
  assert.equal(out[0].scan_id, "s59")
  assert.equal(out.at(-1).scan_id, "s10")
})

test("mergeFeed prefers the server's copy of a row", () => {
  const out = mergeFeed([{ ...row("a", "2026-11-08T10:00:00Z"), flagged: true }], [{ ...row("a", "2026-11-08T10:00:00Z"), flagged: false }])
  assert.equal(out.length, 1)
  assert.equal(out[0].flagged, true)
})
