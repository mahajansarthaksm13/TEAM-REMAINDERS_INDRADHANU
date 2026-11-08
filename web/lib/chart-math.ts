// Pure helpers behind the analysis charts: each returns the series plus the one-line takeaway the
// chart prints under itself, so a reader gets the conclusion without decoding the picture.
// Self-check: node lib/chart-math.check.mjs

export type Share<K extends string> = { key: K; kg: number; pct: number }

// Share of the total per key, largest first. Percentages are rounded and always sum to 100.
export function shares<K extends string>(rows: { key: K; kg: number }[]): Share<K>[] {
  const total = rows.reduce((a, r) => a + Math.max(0, r.kg), 0)
  if (total <= 0) return rows.map((r) => ({ key: r.key, kg: 0, pct: 0 }))
  const raw = rows.map((r) => ({ key: r.key, kg: Math.max(0, r.kg), exact: (Math.max(0, r.kg) / total) * 100 }))
  const out = raw.map((r) => ({ key: r.key, kg: r.kg, pct: Math.floor(r.exact) }))
  // largest-remainder rounding so the legend never reads 99% or 101%
  let left = 100 - out.reduce((a, r) => a + r.pct, 0)
  for (const i of raw.map((r, i) => [r.exact - Math.floor(r.exact), i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i)) {
    if (left-- <= 0) break
    out[i].pct += 1
  }
  return out.sort((a, b) => b.kg - a.kg)
}

export type PacePoint = { month: string; actual: number | null; pace: number }

// Cumulative collection against a straight-line pace to the full-year target.
// `elapsed` = how many months of the year have started (actuals after that are unknown, so null).
export function cumulativePace(monthly: { month: string; kg: number }[], target: number, elapsed: number) {
  let run = 0
  const n = monthly.length || 1
  const data: PacePoint[] = monthly.map((m, i) => {
    run += m.kg
    return { month: m.month, actual: i < elapsed ? +run.toFixed(2) : null, pace: +((target * (i + 1)) / n).toFixed(2) }
  })
  const last = data[Math.min(elapsed, data.length) - 1]
  const gap = last && last.actual !== null ? last.actual - last.pace : 0
  return { data, gap, asOf: last?.month ?? null }
}

// Trust scores in five 20-point bands; `low` counts bins under the anomaly threshold.
export function scoreBuckets(scores: (number | null)[], threshold = 60) {
  const bands = [0, 20, 40, 60, 80].map((lo) => ({ band: `${lo}–${lo === 80 ? 100 : lo + 19}`, lo, bins: 0 }))
  let scored = 0
  let low = 0
  for (const s of scores) {
    if (s === null || !Number.isFinite(s)) continue
    scored++
    if (s < threshold) low++
    bands[Math.min(4, Math.max(0, Math.floor(s / 20)))].bins++
  }
  return { bands, scored, low, unscored: scores.length - scored }
}

// Bins per city split by status, busiest city first.
export function cityCounts(bins: { city: string; status: string }[]) {
  const m = new Map<string, { city: string; active: number; revoked: number }>()
  for (const b of bins) {
    const row = m.get(b.city) ?? { city: b.city, active: 0, revoked: 0 }
    if (b.status === "active") row.active++
    else row.revoked++
    m.set(b.city, row)
  }
  return [...m.values()].sort((a, b) => b.active + b.revoked - (a.active + a.revoked))
}

// ---------- where waste goes ----------
type Flow = { company_id: string; company: string; category: string; city: string; kg: number }

// Three-column flow graph: company -> category -> city, link widths in kg.
// Node ids are prefixed per column so a city and a company can never collide.
export function sankeyFlow(rows: Flow[], label: { category: (c: string) => string; city: (c: string) => string }) {
  const nodes: { name: string; id: string; column: 0 | 1 | 2; kg: number }[] = []
  const index = new Map<string, number>()
  const node = (id: string, name: string, column: 0 | 1 | 2) => {
    if (!index.has(id)) {
      index.set(id, nodes.length)
      nodes.push({ id, name, column, kg: 0 })
    }
    return index.get(id)!
  }
  const linkKg = new Map<string, number>()
  const add = (a: number, b: number, kg: number) => linkKg.set(`${a}>${b}`, (linkKg.get(`${a}>${b}`) ?? 0) + kg)
  // biggest first so the graph reads top-down by size
  const sorted = [...rows].filter((r) => r.kg > 0).sort((a, b) => b.kg - a.kg)
  for (const r of sorted) node(`co:${r.company_id}`, r.company, 0)
  for (const r of sorted) node(`cat:${r.category}`, label.category(r.category), 1)
  for (const r of sorted) node(`city:${r.city}`, label.city(r.city), 2)
  for (const r of sorted) {
    const co = index.get(`co:${r.company_id}`)!
    const cat = index.get(`cat:${r.category}`)!
    const city = index.get(`city:${r.city}`)!
    add(co, cat, r.kg)
    add(cat, city, r.kg)
    nodes[co].kg += r.kg
    nodes[city].kg += r.kg
  }
  for (const [k, v] of linkKg) {
    const [a, b] = k.split(">").map(Number)
    if (nodes[a].column === 0) nodes[b].kg += v
  }
  const links = [...linkKg].map(([k, value]) => {
    const [source, target] = k.split(">").map(Number)
    return { source, target, value: +value.toFixed(3) }
  })
  return { nodes, links }
}

// Sum kg by a key, with each row split by category: one stacked bar per key.
export function stackBy<K extends string>(rows: { kg: number; category: string }[], key: (r: never) => K, categories: readonly string[]) {
  const m = new Map<K, Record<string, number> & { key: K; total: number }>()
  for (const r of rows) {
    const k = key(r as never)
    const row = m.get(k) ?? ({ key: k, total: 0, ...Object.fromEntries(categories.map((c) => [c, 0])) } as Record<string, number> & { key: K; total: number })
    row[r.category] = +(row[r.category] + r.kg).toFixed(3)
    row.total = +(row.total + r.kg).toFixed(3)
    m.set(k, row)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

// Plain-language findings for the flow page: biggest source, biggest destination, concentration.
export function flowInsights(input: {
  total: number
  byCompany: { name: string; kg: number }[]
  byCity: { name: string; kg: number }[]
  byCategory: { name: string; kg: number }[]
  products: { name: string; kg: number }[]
}) {
  const out: string[] = []
  const share = (kg: number) => (input.total > 0 ? Math.round((kg / input.total) * 100) : 0)
  const top = <T extends { kg: number }>(xs: T[]) => [...xs].sort((a, b) => b.kg - a.kg)[0]
  if (input.total <= 0) return ["Nothing was collected in this period."]
  const co = top(input.byCompany)
  if (co && input.byCompany.length > 1) out.push(`${co.name} produced the most collected waste: ${share(co.kg)}% of the total.`)
  const city = top(input.byCity)
  if (city) out.push(input.byCity.length > 1 ? `${city.name} collects the most: ${share(city.kg)}% of all waste ends up in its bins.` : `All collected waste ends up in ${city.name}.`)
  const cat = top(input.byCategory)
  if (cat) out.push(`${cat.name} is the largest stream at ${share(cat.kg)}%.`)
  const prods = [...input.products].sort((a, b) => b.kg - a.kg)
  if (prods.length > 0) {
    const pTotal = prods.reduce((a, p) => a + p.kg, 0)
    const top3 = prods.slice(0, 3).reduce((a, p) => a + p.kg, 0)
    if (prods.length > 3 && pTotal > 0) out.push(`The top 3 products account for ${Math.round((top3 / pTotal) * 100)}% of product-level waste; ${prods[0].name} leads.`)
    else out.push(`${prods[0].name} is the most-collected product.`)
  }
  return out
}
