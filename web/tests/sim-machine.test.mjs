import { test } from "node:test"
import assert from "node:assert/strict"
import { SCENARIOS, initialSim, sim, tolerance, withinTolerance, scenarioWeight } from "../lib/sim-machine.ts"

const run = (...actions) => actions.reduce(sim, initialSim())
const opened = () =>
  run(
    { type: "SCAN", code: "VBQ1.P9999.aaaa" },
    { type: "VALIDATE" },
    { type: "OPEN_OK", sessionId: "s1", product: { name: "Demo bottle", unit_weight_g: 24 } },
    { type: "LID_OPEN" },
  )

test("the bin starts locked", () => {
  assert.equal(initialSim().state, "LOCKED")
})

test("a valid scan walks LOCKED -> QR_SCANNED -> VALIDATING -> OPENING -> OPEN", () => {
  const s = opened()
  assert.equal(s.state, "OPEN")
  assert.equal(s.lidOpened, true)
  assert.equal(s.sessionId, "s1")
})

test("a refused code never reaches OPEN and the lid stays shut", () => {
  const s = run({ type: "SCAN", code: "bad" }, { type: "VALIDATE" }, { type: "OPEN_REFUSED", reason: "qr_unknown" })
  assert.equal(s.state, "REJECTED")
  assert.equal(s.lidOpened, false)
  assert.equal(s.reason, "qr_unknown")
  assert.equal(sim(s, { type: "LID_OPEN" }).state, "REJECTED", "a refused bin cannot be opened afterwards")
})

test("APPROVED is reachable only through a server approval after the checks", () => {
  // jumping straight to a result from OPEN is ignored
  assert.equal(sim(opened(), { type: "SERVER_RESULT", status: "approved" }).state, "OPEN")
  const s = [
    { type: "DROP" },
    { type: "CAMERA" },
    { type: "WEIGH" },
    { type: "SERVER_RESULT", status: "approved", receipt: { scan_id: "x" } },
  ].reduce(sim, opened())
  assert.equal(s.state, "APPROVED")
  assert.deepEqual(s.receipt, { scan_id: "x" })
})

test("the server's review and reject answers map to their states", () => {
  const checked = [{ type: "DROP" }, { type: "CAMERA" }, { type: "WEIGH" }].reduce(sim, opened())
  assert.equal(sim(checked, { type: "SERVER_RESULT", status: "review", reason: "weight_mismatch" }).state, "REVIEW_REQUIRED")
  assert.equal(sim(checked, { type: "SERVER_RESULT", status: "rejected", reason: "no_deposit" }).state, "REJECTED")
})

test("an open lid closes after the verdict: CLOSING -> CLOSED, then a new scan may start", () => {
  const done = [{ type: "DROP" }, { type: "CAMERA" }, { type: "WEIGH" }, { type: "SERVER_RESULT", status: "approved" }].reduce(sim, opened())
  const closed = [{ type: "CLOSE" }, { type: "CLOSED" }].reduce(sim, done)
  assert.equal(closed.state, "CLOSED")
  assert.equal(sim(closed, { type: "SCAN", code: "next" }).state, "QR_SCANNED")
})

test("any failure goes to ERROR and never shows success", () => {
  const s = sim(opened(), { type: "FAIL", message: "backend unreachable" })
  assert.equal(s.state, "ERROR")
  assert.equal(s.receipt, null)
})

test("scans are ignored while a deposit is in progress", () => {
  assert.equal(sim(opened(), { type: "SCAN", code: "other" }).state, "OPEN")
})

test("the scoreboard counts what a scan-counter would have counted vs what VeriBin counted", () => {
  let s = initialSim()
  // A: approved
  s = [{ type: "SCAN", code: "a" }, { type: "VALIDATE" }, { type: "OPEN_OK", sessionId: "1", product: {} }, { type: "LID_OPEN" },
       { type: "DROP" }, { type: "CAMERA" }, { type: "WEIGH" }, { type: "SERVER_RESULT", status: "approved" }, { type: "RESET" }].reduce(sim, s)
  // B: refused
  s = [{ type: "SCAN", code: "b" }, { type: "VALIDATE" }, { type: "OPEN_REFUSED", reason: "qr_unknown" }, { type: "RESET" }].reduce(sim, s)
  // E: review
  s = [{ type: "SCAN", code: "e" }, { type: "VALIDATE" }, { type: "OPEN_OK", sessionId: "2", product: {} }, { type: "LID_OPEN" },
       { type: "DROP" }, { type: "CAMERA" }, { type: "WEIGH" }, { type: "SERVER_RESULT", status: "review" }].reduce(sim, s)
  assert.deepEqual(s.tally, { scans: 3, opened: 2, counted: 1, review: 1, blocked: 1 })
})

test("reset returns the bin to LOCKED but keeps the scoreboard", () => {
  const s = sim(sim(opened(), { type: "SERVER_RESULT", status: "approved" }), { type: "RESET" })
  assert.equal(s.state, "LOCKED")
  assert.equal(s.tally.scans, 1)
  assert.equal(sim(s, { type: "CLEAR_SCORE" }).tally.scans, 0)
})

test("weight tolerance mirrors the backend: max(3 g, 30% of catalogue weight)", () => {
  assert.equal(tolerance(24), 7.2)
  assert.equal(tolerance(3), 3)
  assert.equal(withinTolerance(24, 24), true)
  assert.equal(withinTolerance(31, 24), true)
  assert.equal(withinTolerance(96, 24), false)
})

test("the five judge scenarios are fixed and repeatable", () => {
  assert.deepEqual(SCENARIOS.map((s) => s.id), ["A", "B", "C", "D", "E"])
  const by = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]))
  assert.equal(by.A.code, "fresh")
  assert.equal(by.B.code, "unknown")
  assert.equal(by.C.camera, false)
  assert.equal(by.D.code, "reuse")
  assert.equal(scenarioWeight(by.A, 24), 24)
  assert.equal(scenarioWeight(by.C, 24), 0)
  assert.equal(scenarioWeight(by.E, 24), 96)
})
