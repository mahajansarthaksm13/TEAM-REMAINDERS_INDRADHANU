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

// where waste goes
import { flowInsights, sankeyFlow, stackBy } from "./chart-math.ts"
const rows = [
  { company_id: "a", company: "A", category: "cat1_rigid", city: "PUN", kg: 3 },
  { company_id: "a", company: "A", category: "cat1_rigid", city: "MUM", kg: 1 },
  { company_id: "b", company: "B", category: "cat2_flexible", city: "PUN", kg: 2 },
  { company_id: "b", company: "B", category: "cat2_flexible", city: "PUN", kg: 0 },
]
const g = sankeyFlow(rows, { category: (c) => c, city: (c) => c })
assert.deepEqual(g.nodes.map((n) => n.id), ["co:a", "co:b", "cat:cat1_rigid", "cat:cat2_flexible", "city:PUN", "city:MUM"])
assert.equal(g.links.reduce((a, l) => a + l.value, 0), 12) // every kg crosses two link columns: 6 kg x 2
assert.equal(g.nodes.find((n) => n.id === "city:PUN").kg, 5)
assert.equal(g.nodes.find((n) => n.id === "cat:cat1_rigid").kg, 4)
const s2 = stackBy(rows, (r) => r.city, ["cat1_rigid", "cat2_flexible"])
assert.deepEqual(s2.map((r) => [r.key, r.total, r.cat1_rigid, r.cat2_flexible]), [["PUN", 5, 3, 2], ["MUM", 1, 1, 0]])
const ins = flowInsights({ total: 6, byCompany: [{ name: "A", kg: 4 }, { name: "B", kg: 2 }], byCity: [{ name: "Pune", kg: 5 }, { name: "Mumbai", kg: 1 }], byCategory: [{ name: "Cat I", kg: 4 }], products: [] })
assert.equal(ins[0], "A produced the most collected waste: 67% of the total.")
assert.equal(ins[1], "Pune collects the most: 83% of all waste ends up in its bins.")
assert.deepEqual(flowInsights({ total: 0, byCompany: [], byCity: [], byCategory: [], products: [] }), ["Nothing was collected in this period."])
console.log("flow math ok")
