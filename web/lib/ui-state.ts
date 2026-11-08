// Small pure helpers for client-side UI state that has to survive new data arriving
// (a period change, a scope change, a background refresh). Tests: tests/ui-state.test.mjs

// Filters store what the user HID. Anything not hidden is shown, so items that appear later
// (another period brings a new category) are visible by default. Never returns an empty list:
// if everything still available was hidden, show it all rather than an empty chart.
export function visibleItems<T>(available: readonly T[], hidden: readonly T[]): T[] {
  const shown = available.filter((x) => !hidden.includes(x))
  return shown.length > 0 ? shown : [...available]
}

// Show a hidden item, or hide a visible one unless it is the last one visible.
export function toggleHidden<T>(available: readonly T[], hidden: readonly T[], item: T): T[] {
  if (hidden.includes(item)) return hidden.filter((x) => x !== item)
  const stillShown = available.filter((x) => !hidden.includes(x) && x !== item)
  return stillShown.length > 0 ? [...hidden, item] : [...hidden]
}

// A single-choice filter whose remembered value may no longer be offered (e.g. a city that is
// not in the new scope): fall back instead of rendering an empty chart or crashing.
export function pickOr<T>(value: T, options: readonly T[], fallback: T): T {
  return options.includes(value) ? value : fallback
}

// Live feed: rows from a server refresh merged with rows that arrived over realtime.
// The server's copy wins for the same scan; newest first; at most `max` rows.
export function mergeFeed<R extends { scan_id: string; received_at: string }>(server: R[], current: R[], max = 50): R[] {
  const byId = new Map<string, R>()
  for (const r of current) byId.set(r.scan_id, r)
  for (const r of server) byId.set(r.scan_id, r)
  return [...byId.values()].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, max)
}

// Report preview: results are tagged with the selection they were requested for, and only shown
// (or used to generate a report) while that selection is still the current one. A preview that
// returns after the user changed category or period is ignored instead of mislabelled.
export const selectionKey = (category: string, period: string) => `${category}|${period}`
export function forSelection<E extends { key: string }>(entry: E | undefined, key: string): E | undefined {
  return entry && entry.key === key ? entry : undefined
}
