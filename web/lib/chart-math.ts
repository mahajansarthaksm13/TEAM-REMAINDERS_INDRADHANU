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
