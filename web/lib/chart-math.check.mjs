// Run: node lib/chart-math.check.mjs  (Node 24 strips the types from the imported .ts)
import assert from "node:assert/strict"
import { cityCounts, cumulativePace, scoreBuckets, shares } from "./chart-math.ts"

const s = shares([{ key: "a", kg: 1 }, { key: "b", kg: 1 }, { key: "c", kg: 1 }])
assert.equal(s.reduce((x, r) => x + r.pct, 0), 100) // 33.3 x3 rounds to 100, not 99
assert.deepEqual(shares([{ key: "a", kg: 0 }]).map((r) => r.pct), [0])
assert.equal(shares([{ key: "a", kg: 3 }, { key: "b", kg: 1 }])[0].key, "a")

const p = cumulativePace([{ month: "Apr", kg: 10 }, { month: "May", kg: 20 }, { month: "Jun", kg: 5 }], 60, 2)
assert.deepEqual(p.data.map((d) => d.actual), [10, 30, null])
assert.deepEqual(p.data.map((d) => d.pace), [20, 40, 60])
assert.equal(p.gap, -10) // 30 collected vs 40 pace after two months
assert.equal(p.asOf, "May")

const b = scoreBuckets([10, 59, 60, 100, null])
assert.deepEqual(b.bands.map((x) => x.bins), [1, 0, 1, 1, 1])
assert.equal(b.low, 2)
assert.equal(b.unscored, 1)

assert.deepEqual(cityCounts([{ city: "PUN", status: "active" }, { city: "MUM", status: "revoked" }, { city: "PUN", status: "revoked" }]), [
  { city: "PUN", active: 1, revoked: 1 },
  { city: "MUM", active: 0, revoked: 1 },
])
console.log("chart-math ok")
