// Server-side reads. Every query runs as the logged-in user, so RLS decides what comes back.
// Function names and shapes: docs/CONTRACTS.md §8 + migrations (kg values, IST dates).
import type { userDb } from "./supabase"
import { CATEGORIES, type Category, type FeedRow, type ScoreReason, type Tier } from "./shared"

export type Sb = Awaited<ReturnType<typeof userDb>>

// IST calendar day -> timestamptz bounds
export const istStart = (day: string) => `${day}T00:00:00+05:30`
export const istEndExclusive = (day: string) => {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1))
  return `${d.toISOString().slice(0, 10)}T00:00:00+05:30`
}

const fail = (what: string, e: { message: string } | null) => {
  if (e) throw new Error(`${what}: ${e.message}`)
}

// ---------- KPIs and trend ----------
export async function kpis(sb: Sb, from: string, to: string, companyId: string | null) {
  const { data, error } = await sb.rpc("get_kpis_by_category", { p_from: from, p_to: to, p_company_id: companyId ?? undefined })
  fail("get_kpis_by_category", error)
  const rows = (data ?? []).map((r) => ({
    category: r.category as Category,
    collected_kg: Number(r.collected_kg),
    scan_count: Number(r.scan_count),
    target_kg: r.target_kg === null ? null : Number(r.target_kg),
  }))
  const total_kg = rows.reduce((a, r) => a + r.collected_kg, 0)
  const target_kg = rows.reduce((a, r) => a + (r.target_kg ?? 0), 0)
  return { rows, total_kg, target_kg, scan_count: rows.reduce((a, r) => a + r.scan_count, 0) }
}

export async function monthlyTrend(sb: Sb, from: string, to: string, companyId: string | null) {
  const { data, error } = await sb.rpc("get_monthly_trend", { p_from: from, p_to: to, p_company_id: companyId ?? undefined })
  fail("get_monthly_trend", error)
  const out = new Map<string, Record<Category, number>>()
  for (const r of data ?? []) {
    const m = String(r.month).slice(0, 7)
    const row = out.get(m) ?? { cat1_rigid: 0, cat2_flexible: 0, cat3_multilayer: 0, cat4_compostable: 0 }
    row[r.category as Category] += Number(r.collected_kg)
    out.set(m, row)
  }
  return out
}

// ---------- scans ----------
const SCAN_COLS = "id, bin_id, category, weight_g, weight_ok, code_type, scanned_at, received_at, products(name), bins!inner(city, is_demo), scan_flags(reason)"

type ScanRow = {
  id: string
  bin_id: string
  category: string | null
  weight_g: number
  weight_ok: boolean | null
  code_type: string
  scanned_at: string
  received_at: string
  products: { name: string } | null
  bins: { city: string; is_demo: boolean } | null
  scan_flags: { reason: string }[] | null
}

export const toFeedRow = (s: ScanRow): FeedRow => ({
  scan_id: s.id,
  bin_id: s.bin_id,
  city: s.bins?.city ?? "",
  product_name: s.products?.name ?? "Unknown product",
  category: (s.category ?? "cat1_rigid") as Category,
  weight_g: s.weight_g,
  tier: s.code_type as Tier,
  weight_ok: s.weight_ok,
  flagged: (s.scan_flags?.length ?? 0) > 0,
  scanned_at: s.scanned_at,
  received_at: s.received_at,
})

export async function latestFeed(sb: Sb, companyId: string | null, n = 50) {
  let q = sb.from("scans").select(SCAN_COLS).eq("bins.is_demo", false).order("received_at", { ascending: false }).limit(n)
  if (companyId) q = q.eq("company_id", companyId)
  const { data, error } = await q
  fail("latest scans", error)
  return ((data ?? []) as unknown as ScanRow[]).map(toFeedRow)
}

export async function scanById(sb: Sb, id: string) {
  const { data, error } = await sb.from("scans").select(SCAN_COLS).eq("id", id).maybeSingle()
  fail("scan", error)
  return data ? toFeedRow(data as unknown as ScanRow) : null
}

export type ScanFilters = { category?: string; product?: string; bin?: string; city?: string; from: string; to: string; page: number }
export const PAGE = 50

export async function listScans(sb: Sb, companyId: string | null, f: ScanFilters) {
  let q = sb
    .from("scans")
    .select(SCAN_COLS, { count: "exact" })
    .eq("bins.is_demo", false)
    .gte("scanned_at", istStart(f.from))
    .lt("scanned_at", istEndExclusive(f.to))
    .order("received_at", { ascending: false })
    .range((f.page - 1) * PAGE, f.page * PAGE - 1)
  if (companyId) q = q.eq("company_id", companyId)
  if (f.category) q = q.eq("category", f.category as Category)
  if (f.product) q = q.eq("product_id", f.product)
  if (f.bin) q = q.eq("bin_id", f.bin)
  if (f.city) q = q.eq("bins.city", f.city)
  const { data, count, error } = await q
  fail("scans", error)
  return { rows: ((data ?? []) as unknown as ScanRow[]).map(toFeedRow), total: count ?? 0 }
}

// ---------- bins ----------
export type BinRow = {
  bin_id: string
  company_id: string
  city: string
  status: "active" | "revoked"
  last_seen: string | null
  last_sequence: number
  trust_score: number | null
  trust_reasons: ScoreReason[]
  score_day: string | null
  open_alerts: number
  quiet: boolean
}

export async function binList(sb: Sb, companyId: string | null) {
  const { data, error } = await sb.rpc("get_bin_list")
  fail("get_bin_list", error)
  const now = Date.now()
  return (data ?? [])
    .filter((b) => !b.is_demo && (!companyId || b.company_id === companyId))
    .map(
      (b): BinRow => ({
        bin_id: b.bin_id,
        company_id: b.company_id,
        city: b.city,
        status: b.status,
        last_seen: b.last_seen,
        last_sequence: Number(b.last_sequence),
        trust_score: b.trust_score,
        trust_reasons: (b.trust_reasons as ScoreReason[] | null) ?? [],
        score_day: b.score_day,
        open_alerts: Number(b.open_alerts),
        quiet: isQuiet(b, now),
      })
    )
}

// Same rule as mark_offline_bins: active, has reported, silent for 30+ minutes.
export const isQuiet = (b: Pick<BinRow, "status" | "last_seen">, now: number) =>
  b.status === "active" && !!b.last_seen && now - Date.parse(b.last_seen) > 30 * 60_000

// ---------- targets and forecasts ----------
export async function targetsByCategory(sb: Sb, fy: string, companyId: string | null) {
  let q = sb.from("targets").select("category, target_kg, company_id").eq("financial_year", fy)
  if (companyId) q = q.eq("company_id", companyId)
  const { data, error } = await q
  fail("targets", error)
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const t of data ?? []) out[t.category as Category] += Number(t.target_kg)
  return out
}

// Latest forecast run (as_of) summed per category over the companies in scope.
export async function latestForecasts(sb: Sb, fy: string, companyId: string | null) {
  let q = sb.from("forecasts").select("category, as_of, projected_kg, low_kg, high_kg, created_at, company_id").eq("financial_year", fy).order("as_of", { ascending: false })
  if (companyId) q = q.eq("company_id", companyId)
  const { data, error } = await q
  fail("forecasts", error)
  const asOf = data?.[0]?.as_of ?? null
  const out = new Map<Category, { projected_kg: number; low_kg: number; high_kg: number }>()
  for (const f of (data ?? []).filter((x) => x.as_of === asOf)) {
    const cur = out.get(f.category as Category) ?? { projected_kg: 0, low_kg: 0, high_kg: 0 }
    cur.projected_kg += Number(f.projected_kg)
    cur.low_kg += Number(f.low_kg)
    cur.high_kg += Number(f.high_kg)
    out.set(f.category as Category, cur)
  }
  return { asOf, byCategory: out, ranAt: data?.[0]?.created_at ?? null }
}

// at risk = latest projection below the FY target (same rule the AI job alerts on)
export async function atRiskByCategory(sb: Sb, fy: string, companyId: string | null) {
  const [t, f] = await Promise.all([targetsByCategory(sb, fy, companyId), latestForecasts(sb, fy, companyId)])
  return Object.fromEntries(CATEGORIES.map((c) => [c, (f.byCategory.get(c)?.projected_kg ?? Infinity) < t[c]])) as Record<Category, boolean>
}

// ---------- alerts ----------
export type AlertRow = { id: string; kind: string; bin_id: string | null; company_id: string | null; message: string; opened_at: string }

export async function openAlerts(sb: Sb, companyId: string | null) {
  let q = sb.from("alerts").select("id, kind, bin_id, company_id, message, opened_at").is("closed_at", null).order("opened_at", { ascending: false }).limit(100)
  if (companyId) q = q.or(`company_id.eq.${companyId},company_id.is.null`)
  const { data, error } = await q
  fail("alerts", error)
  return (data ?? []) as AlertRow[]
}

// ---------- QR batches ----------
// PostgREST returns at most 1000 rows per request (max_rows), so a batch is read in pages.
export async function batchCodes(sb: Sb, batchId: string, limit = 10_000) {
  const { data: batch } = await sb.from("qr_batches").select("id, quantity, created_at, products(name, product_code)").eq("id", batchId).maybeSingle()
  if (!batch?.products) return null
  const product = batch.products as unknown as { name: string; product_code: string }
  const serials: string[] = []
  for (let from = 0; serials.length < Math.min(limit, batch.quantity); from += 1000) {
    const { data, error } = await sb.from("qr_codes").select("serial").eq("batch_id", batchId).order("serial").range(from, from + 999)
    fail("qr_codes", error)
    if (!data?.length) break
    serials.push(...data.map((r) => r.serial))
  }
  return {
    id: batch.id,
    created_at: batch.created_at,
    quantity: batch.quantity,
    product,
    payloads: serials.slice(0, limit).map((s) => `VBQ1.${product.product_code}.${s}`),
  }
}
