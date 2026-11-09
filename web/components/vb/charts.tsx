"use client"

// Charts on the light neumorphic ground. Four colours only: Night, Violet, Orchid (+ a Violet-hatched
// Snow for Category IV, so no series depends on colour alone).
//
// Every chart follows one reading order, top to bottom:
//   1. filters that suit its data (they recompute in the browser, no reload),
//   2. the picture (redrawn with its entrance animation whenever a filter changes),
//   3. a one-line takeaway that is recomputed for the filtered data and announced to screen readers.
// Props stay serialisable: server pages render these, so no function props.
import { useId, useState } from "react"
import { cn } from "cn"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, cityName, type Category } from "@/lib/shared"
import { cityCounts, cumulativePace, pctDelta, sankeyFlow, scoreBuckets, shares } from "@/lib/chart-math"
import { CategorySwatch, DeltaChip } from "./ui"
import { CountUp } from "./count-up"
import { CategoryChips, Chips, FilterBar, Segmented } from "./chart-controls"
import { pickOr, visibleItems } from "@/lib/ui-state"

const SNOW = "#FBFBFB"
const VIOLET = "#6F2DBD"
const ORCHID = "#A663CC"
const NIGHT = "#171123"
const DIM = "rgba(23,17,35,0.68)"
const GRID = "rgba(23,17,35,0.08)"
const axis = { stroke: DIM, fontSize: 12, tickLine: false, axisLine: false } as const
const tooltipStyle = {
  contentStyle: {
    borderRadius: 14,
    background: SNOW,
    border: "1px solid rgba(111,45,189,0.25)",
    boxShadow: "-4px -4px 10px #FBFBFB, 6px 6px 16px rgba(23,17,35,0.16)",
    fontSize: 13,
    color: NIGHT,
  },
  labelStyle: { color: DIM },
  itemStyle: { color: NIGHT },
}
const kgFmt = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`
const numFmt = (v: number) => v.toLocaleString("en-IN")
const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
const sumBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0)

// Category IV is hatched; a per-chart id keeps two charts on one page from sharing a pattern id.
function useHatch() {
  const id = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const def = (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill={SNOW} />
        <line x1="0" y1="0" x2="0" y2="8" stroke={VIOLET} strokeWidth="3" />
      </pattern>
    </defs>
  )
  return { def, fill: (c: Category) => (c === "cat4_compostable" ? `url(#${id})` : CATEGORY_COLOR[c]) }
}

// The picture. `swap` changes whenever a filter does: the chart remounts, replays its draw-in, and
// the box eases in. role="img" + label describes exactly what is drawn after filtering.
function Plot({ swap, label, className, style, children }: { swap: string; label: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div key={swap} role="img" aria-label={label} className={cn("chart-swap", className)} style={style}>
      {children}
    </div>
  )
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <p aria-live="polite" className="mt-3 flex items-start gap-2 text-sm text-ink">
      <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-orchid" />
      <span>{children}</span>
    </p>
  )
}

// ── Monthly stacked bars ──────────────────────────────────────
export function TrendChart({ data }: { data: ({ month: string } & Record<Category, number>)[] }) {
  const h = useHatch()
  const [hidden, setHidden] = useState<Category[]>([])
  const cats = visibleItems(CATEGORIES, hidden)
  const [view, setView] = useState<"kg" | "share">("kg")
  const rows = data.map((d) => {
    const tot = sumBy(cats, (c) => d[c])
    return { month: d.month, total: tot, ...Object.fromEntries(cats.map((c) => [c, view === "kg" ? d[c] : tot > 0 ? +((d[c] / tot) * 100).toFixed(1) : 0])) }
  }) as ({ month: string; total: number } & Record<Category, number>)[]
  const best = rows.reduce((a, b) => (b.total > a.total ? b : a), { month: "", total: 0 } as { month: string; total: number })
  const fmt = (v: number) => (view === "kg" ? kgFmt(v) : `${v}%`)
  return (
    <div>
      <FilterBar>
        <Segmented label="Show as" value={view} onChange={setView} options={[{ value: "kg", label: "Kilograms" }, { value: "share", label: "% of month" }]} />
        <CategoryChips hidden={hidden} onChange={setHidden} />
      </FilterBar>
      <Plot swap={`${view}${cats}`} label={`${view === "kg" ? "Kilograms" : "Share of each month"} collected per month for ${cats.map((c) => CATEGORY_LABEL[c]).join(", ")}.`} className="h-60 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            {h.def}
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} width={48} domain={view === "share" ? [0, 100] : undefined} tickFormatter={(v) => (view === "share" ? `${v}%` : `${v}`)} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v, n) => [fmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {cats.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={h.fill(c)} stroke={c === "cat4_compostable" ? VIOLET : undefined} radius={i === cats.length - 1 ? [4, 4, 0, 0] : 0} animationDuration={700} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>
        {best.total > 0 ? (
          <>Busiest month for the selected categories: <strong>{best.month}</strong>, {kgFmt(best.total)}.{view === "share" ? " Each bar shows how that month splits across them." : ""}</>
        ) : (
          "No collection recorded for these categories this financial year yet."
        )}
      </Takeaway>
    </div>
  )
}

// ── Category mix donut ────────────────────────────────────────
export function ShareDonut({ data, caption }: { data: { category: Category; kg: number }[]; caption?: string }) {
  const h = useHatch()
  const [hidden, setHidden] = useState<Category[]>([])
  const cats = visibleItems(CATEGORIES, hidden)
  const s = shares(data.filter((d) => cats.includes(d.category)).map((d) => ({ key: d.category, kg: d.kg })))
  const slices = s.filter((r) => r.kg > 0)
  const total = sumBy(s, (r) => r.kg)
  const top = s[0]
  const partial = cats.length < CATEGORIES.length
  return (
    <div>
      <FilterBar>
        <CategoryChips hidden={hidden} onChange={setHidden} />
      </FilterBar>
      <div className="@container">
      <div className="grid items-center gap-5 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Plot swap={cats.join()} label={`Share of collection: ${s.map((r) => `${CATEGORY_LABEL[r.key]} ${r.pct}%`).join(", ")}.`} className="relative mx-auto aspect-square w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {h.def}
              <Pie data={slices} dataKey="kg" nameKey="key" innerRadius="74%" outerRadius="100%" paddingAngle={3} cornerRadius={8} stroke="none" animationDuration={800}>
                {slices.map((r) => <Cell key={r.key} fill={h.fill(r.key)} stroke={r.key === "cat4_compostable" ? VIOLET : "none"} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="eyebrow text-dim">{partial ? "Selected" : "Total"}</span>
            <CountUp value={kgFmt(total)} className="tnum font-display text-xl font-semibold" />
          </div>
        </Plot>
        <ul className="space-y-2.5">
          {s.map((r) => (
            <li key={r.key} className="flex items-center gap-3 text-sm">
              <CategorySwatch category={r.key} className="size-3.5" />
              <span className="flex-1">{CATEGORY_LABEL[r.key]}</span>
              <span className="tnum whitespace-nowrap text-dim">{kgFmt(r.kg)}</span>
              <span className="tnum w-10 text-right font-semibold">{r.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
      <Takeaway>
        {total > 0 ? (
          <><strong>{CATEGORY_LABEL[top.key]}</strong> makes up {top.pct}% of {partial ? "the selected categories" : "everything collected"}{caption ? ` ${caption}` : ""}.</>
        ) : (
          "Nothing collected for these categories yet."
        )}
      </Takeaway>
    </div>
  )
}

// ── Collection vs target pace ─────────────────────────────────
export function PaceChart({ monthly, target, elapsed }: { monthly: { month: string; kg: number }[]; target: number; elapsed: number }) {
  const [view, setView] = useState<"running" | "monthly">("running")
  const p = cumulativePace(monthly, target, elapsed)
  const ahead = p.gap >= 0
  const fillId = `pace-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const perMonth = monthly.length ? target / monthly.length : 0
  const months = monthly.map((m, i) => ({ month: m.month, actual: i < elapsed ? +m.kg.toFixed(2) : null, pace: +perMonth.toFixed(2) }))
  const hit = months.filter((m) => m.actual !== null && m.actual >= perMonth).length
  return (
    <div>
      <FilterBar>
        <Segmented label="View" value={view} onChange={setView} options={[{ value: "running", label: "Running total" }, { value: "monthly", label: "Month by month" }]} />
      </FilterBar>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-2 w-4 rounded-sm bg-violet" /> {view === "running" ? "Collected so far" : "Collected that month"}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-4 border-t-2 border-dashed border-orchid" /> {view === "running" ? "Even pace to target" : "Monthly share of the target"}</li>
      </ul>
      <Plot swap={view} label={view === "running" ? `Running total against an even pace to ${kgFmt(target)}.` : `Each month's collection against ${kgFmt(perMonth)} per month.`} className="h-56 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
          {view === "running" ? (
            <AreaChart data={p.data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VIOLET} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} width={52} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [kgFmt(Number(v)), n === "actual" ? "Collected so far" : "Even pace"]} />
              <Area type="monotone" dataKey="pace" stroke={ORCHID} strokeDasharray="6 4" strokeWidth={2} fill="none" animationDuration={800} />
              <Area type="monotone" dataKey="actual" stroke={VIOLET} strokeWidth={2.5} fill={`url(#${fillId})`} connectNulls={false} animationDuration={1100} activeDot={{ r: 5, fill: SNOW, stroke: VIOLET, strokeWidth: 2 }} />
            </AreaChart>
          ) : (
            <ComposedChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} width={52} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.06)" }} formatter={(v, n) => [kgFmt(Number(v)), n === "actual" ? "Collected" : "Monthly share of target"]} />
              <Bar dataKey="actual" fill={VIOLET} radius={[6, 6, 0, 0]} barSize={18} animationDuration={900} />
              <Line type="monotone" dataKey="pace" stroke={ORCHID} strokeDasharray="6 4" strokeWidth={2} dot={false} animationDuration={700} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </Plot>
      <Takeaway>
        {target <= 0 ? (
          "No target set for this financial year."
        ) : !p.asOf ? (
          "The financial year hasn't started yet."
        ) : view === "running" ? (
          <>{ahead ? "Ahead of" : "Behind"} an even pace by <strong>{kgFmt(Math.abs(p.gap))}</strong> at the end of {p.asOf}. {ahead ? "On track." : "Collection needs to speed up to meet the target."}</>
        ) : (
          <><strong>{hit}</strong> of {Math.min(elapsed, months.length)} months so far reached their {kgFmt(perMonth)} share of the target.</>
        )}
      </Takeaway>
    </div>
  )
}

// ── Progress to target, one ring per category ─────────────────
export function TargetRings({ rows }: { rows: { category: Category; collected_kg: number; target_kg: number }[] }) {
  const h = useHatch()
  const [view, setView] = useState<"progress" | "left">("progress")
  const data = rows.map((r) => ({ ...r, name: CATEGORY_LABEL[r.category], pct: r.target_kg > 0 ? Math.min(100, Math.round((r.collected_kg / r.target_kg) * 100)) : 0, left: Math.max(0, r.target_kg - r.collected_kg) }))
  const lagging = data.filter((d) => d.target_kg > 0).sort((a, b) => a.pct - b.pct)[0]
  const mostLeft = [...data].sort((a, b) => b.left - a.left)[0]
  const rings = [...data].reverse() // first category on the outside ring
  return (
    <div>
      <FilterBar>
        <Segmented label="Show" value={view} onChange={setView} options={[{ value: "progress", label: "Progress" }, { value: "left", label: "Still to collect" }]} />
      </FilterBar>
      <div className="@container">
      <div className="grid items-center gap-5 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Plot swap={view} label={`Progress to target by category: ${data.map((d) => `${d.name} ${d.pct}%`).join(", ")}.`} className="mx-auto aspect-square w-full max-w-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart data={rings} innerRadius="28%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={12}>
              {h.def}
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
              <RadialBar dataKey={view === "progress" ? "pct" : "left"} cornerRadius={8} background={{ fill: "rgba(23,17,35,0.06)" }} animationDuration={900}>
                {rings.map((d) => <Cell key={d.category} fill={h.fill(d.category)} stroke={d.category === "cat4_compostable" ? VIOLET : "none"} />)}
              </RadialBar>
            </RadialBarChart>
          </ResponsiveContainer>
        </Plot>
        <ul className="space-y-2.5">
          {data.map((d) => (
            <li key={d.category} className="flex items-center gap-3 text-sm">
              <CategorySwatch category={d.category} className="size-3.5" />
              <span className="flex-1">{d.name}</span>
              <span className="tnum text-right font-semibold whitespace-nowrap">{view === "progress" ? `${d.pct}%` : kgFmt(d.left)}</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
      <Takeaway>
        {!lagging ? (
          "No targets set."
        ) : view === "progress" ? (
          <>Furthest behind: <strong>{lagging.name}</strong> at {lagging.pct}% of its target. A full ring is 100%.</>
        ) : (
          <>The biggest job left is <strong>{mostLeft.name}</strong>: {kgFmt(mostLeft.left)} still to collect. Longer rings mean more left to collect.</>
        )}
      </Takeaway>
    </div>
  )
}

// ── Trust-score distribution ──────────────────────────────────
export function ScoreHistogram({ bins, threshold = 60 }: { bins: { city: string; status: string; score: number | null }[]; threshold?: number }) {
  const cities = [...new Set(bins.map((b) => b.city))].sort()
  const [chosenCity, setCity] = useState("all")
  const city = pickOr(chosenCity, ["all", ...cities], "all") // a city from an earlier scope may be gone
  const [status, setStatus] = useState<"all" | "active" | "revoked">("all")
  const pick = bins.filter((b) => (city === "all" || b.city === city) && (status === "all" || b.status === status))
  const b = scoreBuckets(pick.map((x) => x.score), threshold)
  return (
    <div>
      <FilterBar>
        {cities.length > 1 && <Segmented label="City" value={city} onChange={setCity} options={[{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c, label: cityName(c) }))]} />}
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "revoked", label: "Revoked" }]} />
      </FilterBar>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-orchid" /> Below {threshold}: anomaly, check the bin</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-violet" /> {threshold} and above: healthy</li>
      </ul>
      <Plot swap={`${city}${status}`} label={`Trust scores of ${b.scored} bins in five bands; ${b.low} below ${threshold}.`} className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={b.bands} margin={{ top: 18, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="band" {...axis} />
            <YAxis {...axis} allowDecimals={false} width={40} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v) => [`${v} bins`, "Bins"]} labelFormatter={(l) => `Score ${l}`} />
            <Bar dataKey="bins" radius={[6, 6, 0, 0]} animationDuration={800}>
              {b.bands.map((x) => <Cell key={x.band} fill={x.lo < threshold ? ORCHID : VIOLET} />)}
              <LabelList dataKey="bins" position="top" style={{ fill: NIGHT, fontSize: 11, fontWeight: 600 }} formatter={(v) => (Number(v) > 0 ? v : "")} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>
        {b.scored === 0 ? (
          pick.length ? `None of these ${pick.length} bins has a score yet. Bins are scored nightly once they have 20+ scans.` : "No bins match these filters."
        ) : (
          <><strong>{b.low}</strong> of {b.scored} scored bins {b.low === 1 ? "is" : "are"} below {threshold} and worth a look{b.unscored ? `; ${b.unscored} not scored yet` : ""}.</>
        )}
      </Takeaway>
    </div>
  )
}

// ── Bins per city ─────────────────────────────────────────────
export function CityBins({ bins }: { bins: { city: string; status: string }[] }) {
  const [status, setStatus] = useState<"all" | "active" | "revoked">("all")
  const data = cityCounts(bins).map((r) => ({ ...r, name: cityName(r.city), active: status === "revoked" ? 0 : r.active, revoked: status === "active" ? 0 : r.revoked }))
  const ranked = [...data].sort((a, b) => b.active + b.revoked - (a.active + a.revoked))
  const top = ranked[0]
  const word = status === "all" ? "bins" : `${status} bins`
  return (
    <div>
      <FilterBar>
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "revoked", label: "Revoked" }]} />
      </FilterBar>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        {status !== "revoked" && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-violet" /> Active</li>}
        {status !== "active" && <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-orchid" /> Revoked</li>}
      </ul>
      <Plot swap={status} label={`${word} per city: ${data.map((d) => `${d.name} ${d.active + d.revoked}`).join(", ")}.`} style={{ height: Math.max(120, data.length * 48) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 8 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" {...axis} allowDecimals={false} />
            <YAxis type="category" dataKey="name" {...axis} width={72} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v, n) => [`${v} bins`, n === "active" ? "Active" : "Revoked"]} />
            {status !== "revoked" && <Bar dataKey="active" stackId="s" fill={VIOLET} radius={status === "active" ? [0, 6, 6, 0] : 0} animationDuration={800} />}
            {status !== "active" && <Bar dataKey="revoked" stackId="s" fill={ORCHID} radius={[0, 6, 6, 0]} animationDuration={800} />}
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>{top && top.active + top.revoked > 0 ? <><strong>{top.name}</strong> has the most {word}: {top.active + top.revoked}.</> : `No ${word}.`}</Takeaway>
    </div>
  )
}

export type ForecastPoint = { month: string; actual: number | null; projected: number | null; band: [number, number] | null }

export function ForecastChart({ data, target, atRisk }: { data: ForecastPoint[]; target: number; atRisk?: boolean }) {
  const [band, setBand] = useState<"show" | "hide">("show")
  return (
    <div>
      <FilterBar>
        <Segmented label="Forecast range" value={band} onChange={setBand} options={[{ value: "show", label: "With likely range" }, { value: "hide", label: "Projection only" }]} />
      </FilterBar>
      <Plot swap={band} label={`Actual and projected collection against a target of ${kgFmt(target)}. ${atRisk ? "Projected to fall short." : "Projected to meet the target."}`} className="h-60 lg:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 56, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} width={48} domain={[0, (max: number) => Math.ceil(Math.max(max, target) * 1.1)]} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v, n) => {
                if (Array.isArray(v)) return [`${kgFmt(Number(v[0]))} – ${kgFmt(Number(v[1]))}`, "Likely range"]
                return [kgFmt(Number(v)), n === "actual" ? "Actual" : "Projection"]
              }}
            />
            {band === "show" && <Area dataKey="band" stroke="none" fill={ORCHID} fillOpacity={0.18} animationDuration={700} connectNulls />}
            <Line dataKey="actual" stroke={NIGHT} strokeWidth={2} dot={false} animationDuration={700} />
            <Line dataKey="projected" stroke={VIOLET} strokeWidth={2} strokeDasharray="6 4" dot={false} animationDuration={700} connectNulls />
            <ReferenceLine
              y={target}
              stroke={atRisk ? VIOLET : DIM}
              strokeDasharray="2 3"
              strokeWidth={1.5}
              label={{ value: `Target ${kgFmt(target)}`, position: "insideTopRight", fill: atRisk ? VIOLET : DIM, fontSize: 12, fontWeight: 600 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Plot>
    </div>
  )
}

export function ScoreChart({ data }: { data: { day: string; score: number }[] }) {
  const [range, setRange] = useState<"30" | "90" | "all">("90")
  const rows = range === "all" ? data : data.slice(-Number(range))
  const first = rows[0]?.score
  const last = rows.at(-1)?.score
  const below = rows.filter((r) => r.score < 60).length
  return (
    <div>
      <FilterBar>
        <Segmented label="Range" value={range} onChange={setRange} options={[{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "all", label: "All" }]} />
      </FilterBar>
      <Plot swap={range} label={`Trust score over ${rows.length} days. Latest ${last ?? "none"}; anomaly threshold 60.`} className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
            <YAxis {...axis} domain={[0, 100]} width={44} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, "Trust score"]} />
            <ReferenceLine y={60} stroke={VIOLET} strokeDasharray="2 3" label={{ value: "Anomaly threshold", position: "insideBottomRight", fill: VIOLET, fontSize: 11 }} />
            <Line type="monotone" dataKey="score" stroke={NIGHT} strokeWidth={2} dot={false} animationDuration={900} />
          </LineChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>{rows.length > 1 && first !== undefined && last !== undefined ? <>Score moved from {first} to <strong>{last}</strong> over these {rows.length} days; {below} {below === 1 ? "day was" : "days were"} below the threshold.</> : "Not enough scored days yet."}</Takeaway>
    </div>
  )
}

// ── Where waste goes: company -> category -> city ─────────────
type FlowIn = { company_id: string; company: string; category: Category; city: string; kg: number }
type NodeP = { x: number; y: number; width: number; height: number; index: number; payload: { id: string; name: string; column: number; kg: number } }
type LinkP = {
  sourceX: number
  sourceY: number
  sourceControlX: number
  targetX: number
  targetY: number
  targetControlX: number
  linkWidth: number
  payload: { source: { id: string; column: number }; target: { id: string; column: number }; value: number }
}

export function FlowSankey({ rows }: { rows: FlowIn[] }) {
  const h = useHatch()
  const companies = [...new Map(rows.map((r) => [r.company_id, r.company])).entries()]
  const presentCats = CATEGORIES.filter((c) => rows.some((r) => r.category === c && r.kg > 0))
  const [hiddenCos, setHiddenCos] = useState<string[]>([])
  const [hiddenCats, setHiddenCats] = useState<Category[]>([])
  const cos = visibleItems(companies.map(([id]) => id), hiddenCos)
  const cats = visibleItems(presentCats, hiddenCats)
  const picked = rows.filter((r) => cos.includes(r.company_id) && cats.includes(r.category))
  const g = sankeyFlow(picked, { category: (c) => CATEGORY_LABEL[c as Category] ?? c, city: (c) => cityName(c) })
  const perColumn = [0, 1, 2].map((c) => g.nodes.filter((n) => n.column === c).length)
  // Every node gets room for its two-line label (name + kg); small streams never collide or clip.
  const height = Math.max(320, Math.max(...perColumn) * 84)
  const total = sumBy(g.nodes.filter((n) => n.column === 0), (n) => n.kg)
  const fill = (n: NodeP["payload"]) => (n.column === 0 ? VIOLET : n.column === 2 ? NIGHT : h.fill(n.id.slice(4) as Category))
  // Each band carries the colour of its EPR category, so a stream can be followed end to end.
  const bandCategory = (l: LinkP["payload"]) => (l.source.column === 1 ? l.source.id : l.target.id).slice(4) as Category
  const topCity = g.nodes.filter((n) => n.column === 2).sort((a, b) => b.kg - a.kg)[0]
  if (rows.length === 0) return <p className="text-sm text-dim">Nothing collected in this period, so there is no flow to show.</p>
  return (
    <div>
      <FilterBar>
        {companies.length > 1 && (
          <Chips label="Companies" all={companies.map(([id]) => id)} hidden={hiddenCos} onChange={setHiddenCos} render={(id) => companies.find(([c]) => c === id)?.[1] ?? id} />
        )}
        {presentCats.length > 1 && <CategoryChips hidden={hiddenCats} onChange={setHiddenCats} available={presentCats} />}
      </FilterBar>
      <div className="mb-2 grid grid-cols-3 text-xs font-semibold tracking-[0.12em] text-dim uppercase">
        <span>Produced by</span>
        <span className="text-center">EPR category</span>
        <span className="text-right">Collected in</span>
      </div>
      <div className="-mx-2 overflow-x-auto px-2">
        <Plot swap={`${cos}${cats}`} label={`Flow of ${kgFmt(total)} from ${perColumn[0]} companies through ${perColumn[1]} categories to ${perColumn[2]} cities.`} className="min-w-[620px]" style={{ height }}>
          {g.links.length === 0 ? (
            <p className="pt-10 text-center text-sm text-dim">Nothing collected for this selection.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={{ nodes: g.nodes, links: g.links }}
                nodeWidth={14}
                nodePadding={40}
                margin={{ top: 24, right: 136, bottom: 24, left: 136 }}
                link={(raw) => {
                  const l = raw as unknown as LinkP
                  const c = bandCategory(l.payload)
                  return (
                    <path
                      d={`M${l.sourceX},${l.sourceY} C${l.sourceControlX},${l.sourceY} ${l.targetControlX},${l.targetY} ${l.targetX},${l.targetY}`}
                      fill="none"
                      stroke={c === "cat4_compostable" ? VIOLET : CATEGORY_COLOR[c]}
                      strokeOpacity={c === "cat4_compostable" ? 0.18 : 0.28}
                      strokeDasharray={c === "cat4_compostable" ? "6 3" : undefined}
                      strokeWidth={Math.max(1.5, l.linkWidth)}
                      className="flow-band transition-[stroke-opacity] duration-200 hover:[stroke-opacity:0.55]"
                    />
                  )
                }}
                node={(raw) => {
                  const p = raw as unknown as NodeP
                  const lx = p.payload.column === 0 ? p.x - 10 : p.x + p.width + 10
                  const cy = p.y + p.height / 2
                  return (
                    <g>
                      {p.index === 0 && h.def}
                      <rect x={p.x} y={p.y} width={p.width} height={Math.max(4, p.height)} rx={4} fill={fill(p.payload)} stroke={p.payload.column === 1 ? VIOLET : "none"} strokeWidth={p.payload.column === 1 ? 1 : 0} />
                      {/* two-line label centred on the node: name above the middle, weight below */}
                      <text x={lx} y={cy - 8} textAnchor={p.payload.column === 0 ? "end" : "start"} dominantBaseline="middle" fontSize={12.5} fontWeight={600} fill={NIGHT}>
                        {p.payload.name}
                      </text>
                      <text x={lx} y={cy + 9} textAnchor={p.payload.column === 0 ? "end" : "start"} dominantBaseline="middle" fontSize={12} fill={DIM} className="tnum">
                        {kgFmt(p.payload.kg)}
                      </text>
                    </g>
                  )
                }}
              >
                <Tooltip {...tooltipStyle} formatter={(v) => [kgFmt(Number(v)), "Collected"]} />
              </Sankey>
            </ResponsiveContainer>
          )}
        </Plot>
      </div>
      <Takeaway>
        {topCity ? <>{kgFmt(total)} selected; <strong>{topCity.name}</strong> collects {pctOf(topCity.kg, total)}% of it.</> : "Nothing selected."} Read left to right; band width is weight, band colour is the category.
      </Takeaway>
    </div>
  )
}

// ── One stacked bar per company / city, split by category ─────
const PLURAL = { company: "companies", city: "cities" } as const

export function CategoryStack({ data, label, subject }: { data: ({ key: string; name: string; total: number } & Record<string, number | string>)[]; label: string; subject: keyof typeof PLURAL }) {
  const h = useHatch()
  const [hidden, setHidden] = useState<Category[]>([])
  const cats = visibleItems(CATEGORIES, hidden)
  const [sort, setSort] = useState<"size" | "name">("size")
  const rows = data
    .map((d) => ({ ...d, shown: sumBy(cats, (c) => Number(d[c] ?? 0)) }))
    .sort((a, b) => (sort === "size" ? b.shown - a.shown : String(a.name).localeCompare(String(b.name))))
  const total = sumBy(rows, (r) => r.shown)
  const top = [...rows].sort((a, b) => b.shown - a.shown)[0]
  return (
    <div>
      <FilterBar>
        <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: "size", label: "Largest first" }, { value: "name", label: "A–Z" }]} />
        <CategoryChips hidden={hidden} onChange={setHidden} />
      </FilterBar>
      <Plot swap={`${sort}${cats}`} label={`${label}: ${rows.map((d) => `${d.name} ${kgFmt(d.shown)}`).join(", ")}.`} style={{ height: Math.max(140, rows.length * 52) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }}>
            {h.def}
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="name" {...axis} width={128} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {cats.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="s" fill={h.fill(c)} stroke={c === "cat4_compostable" ? VIOLET : undefined} radius={i === cats.length - 1 ? [0, 6, 6, 0] : 0} animationDuration={800}>
                {i === cats.length - 1 && <LabelList dataKey="shown" position="right" offset={8} formatter={(v) => kgFmt(Number(v))} style={{ fill: NIGHT, fontSize: 11, fontWeight: 600 }} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>{top && total > 0 ? <><strong>{top.name}</strong> accounts for {pctOf(top.shown, total)}% of the selected waste across {rows.length} {rows.length === 1 ? subject : PLURAL[subject]}.</> : "Nothing collected for these categories."}</Takeaway>
    </div>
  )
}

// ── Top products by collected weight ──────────────────────────
export function ProductBars({ products }: { products: { name: string; company?: string; category: Category; kg: number; scans: number }[] }) {
  const h = useHatch()
  const [n, setN] = useState<"5" | "10" | "20">("10")
  const present = CATEGORIES.filter((c) => products.some((p) => p.category === c))
  const [hidden, setHidden] = useState<Category[]>([])
  const cats = visibleItems(present, hidden)
  const pool = products.filter((p) => cats.includes(p.category))
  const data = pool.slice(0, Number(n)).map((p) => ({ ...p, label: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name }))
  const total = sumBy(pool, (p) => p.kg)
  const shownKg = sumBy(data, (p) => p.kg)
  const top = data[0]
  return (
    <div>
      <FilterBar>
        <Segmented label="How many" value={n} onChange={setN} options={[{ value: "5", label: "Top 5" }, { value: "10", label: "Top 10" }, { value: "20", label: "Top 20" }]} />
        {present.length > 1 && <CategoryChips hidden={hidden} onChange={setHidden} available={present} />}
      </FilterBar>
      <Plot swap={`${n}${cats}`} label={`Top ${data.length} products by collected weight.${top ? ` ${top.name} leads with ${kgFmt(top.kg)}.` : ""}`} style={{ height: Math.max(140, data.length * 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }}>
            {h.def}
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="label" {...axis} width={150} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: "rgba(111,45,189,0.08)" }}
              formatter={(v, _n, item) => [`${kgFmt(Number(v))} · ${numFmt((item.payload as { scans: number }).scans)} scans`, (item.payload as { company?: string }).company ?? CATEGORY_LABEL[(item.payload as { category: Category }).category]]}
            />
            <Bar dataKey="kg" radius={[0, 6, 6, 0]} animationDuration={800}>
              {data.map((p) => <Cell key={p.name + (p.company ?? "")} fill={h.fill(p.category)} stroke={p.category === "cat4_compostable" ? VIOLET : undefined} />)}
              <LabelList dataKey="kg" position="right" offset={8} formatter={(v) => kgFmt(Number(v))} style={{ fill: NIGHT, fontSize: 11, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>
        {top ? <><strong>{top.name}</strong> leads with {kgFmt(top.kg)}. These {data.length} products make up {pctOf(shownKg, total)}% of the selected product waste.</> : "No product scans for these categories."}
      </Takeaway>
    </div>
  )
}

// ── Reference-style cards ─────────────────────────────────────
type Point = { day: string; value: number }
type DayPoint = { day: string; scans: number; kg: number }
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }).slice(0, 2)
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })

// Filled Violet headline card. The window filter (7 / 14 / 30 full days) drives the sparkline,
// the caption figure and the change badge (that window vs the one before it).
export function HeroStat({ label, value, caption, daily }: { label: string; value: string; caption: string; daily: Point[] }) {
  const id = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const [win, setWin] = useState<"7" | "14" | "30">("7")
  const w = Number(win)
  const cur = daily.slice(-w)
  const prev = daily.length >= 2 * w ? daily.slice(-2 * w, -w) : null
  const sum = sumBy(cur, (d) => d.value)
  const delta = prev ? pctDelta(sum, sumBy(prev, (d) => d.value)) : null
  return (
    <div className="btn-lit relative isolate flex h-full flex-col justify-between gap-4 overflow-hidden rounded-card p-5 text-snow sm:p-6" role="group" aria-label={`${label}: ${value}`}>
      <span aria-hidden className="float-slow absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-orchid/35" />
      <span aria-hidden className="float-slow absolute -top-4 right-16 -z-10 size-28 rounded-full bg-snow/10 [animation-delay:-4s]" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="eyebrow text-snow/85">{label}</p>
        <div role="group" aria-label="Window" className="inline-flex gap-0.5 rounded-full bg-snow/15 p-0.5">
          {(["7", "14", "30"] as const).map((o) => (
            <button key={o} type="button" aria-pressed={win === o} onClick={() => setWin(o)} className={cn("h-7 rounded-full px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-snow focus-visible:outline-none", win === o ? "bg-snow text-violet" : "text-snow/85 hover:text-snow")}>
              {o}D
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-[34px] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap lg:text-[40px]"><CountUp value={value} className="tnum" /></p>
          <p className="mt-2 text-sm text-snow/85" aria-live="polite">{caption} · <strong className="text-snow">{kgFmt(sum)}</strong> in the last {w} full days</p>
          <div className="mt-2"><DeltaChip value={delta} label={`last ${w} full days vs the ${w} before`} tone="onViolet" /></div>
        </div>
        <div key={win} className="chart-swap h-14 w-28 shrink-0 sm:w-40" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cur} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SNOW} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={SNOW} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={SNOW} strokeWidth={2} fill={`url(#${id})`} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// Pill bars on tracks. Filters: window (7 / 14 days, today in progress on the right) and measure
// (scans / kg). The change badge always compares whole days: the last N full days vs the N before.
export function PillBars({ title, days, today, legend }: { title: string; days: DayPoint[]; today: DayPoint; legend?: { label: string; pct: number; tone: "violet" | "orchid" }[] }) {
  const [win, setWin] = useState<"7" | "14">("7")
  const [metric, setMetric] = useState<"scans" | "kg">("scans")
  const w = Number(win)
  const val = (d: DayPoint) => (metric === "scans" ? d.scans : +d.kg.toFixed(2))
  const fmt = (v: number) => (metric === "scans" ? `${numFmt(v)} scans` : kgFmt(v))
  const bars = [...days.slice(-(w - 1)), today].map((d) => ({ day: d.day, value: val(d), label: w === 7 ? shortDay(d.day) : shortDate(d.day) }))
  const full = days.slice(-w)
  const prev = days.length >= 2 * w ? days.slice(-2 * w, -w) : null
  const delta = prev ? pctDelta(sumBy(full, val), sumBy(prev, val)) : null
  const total = sumBy(bars, (b) => b.value)
  const best = bars.slice(0, -1).reduce((a, b) => (b.value > a.value ? b : a), bars[0])
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-h3">{title}</p>
          <p className="text-sm text-dim">Last {w} days · today so far, in Violet</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="tnum font-display text-2xl font-semibold" aria-live="polite">{metric === "scans" ? numFmt(total) : kgFmt(total)}</p>
          <DeltaChip value={delta} label={`last ${w} full days vs the ${w} before`} />
        </div>
      </div>
      <div className="mt-4">
        <FilterBar>
          <Segmented label="Window" value={win} onChange={setWin} options={[{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }]} />
          <Segmented label="Measure" value={metric} onChange={setMetric} options={[{ value: "scans", label: "Scans" }, { value: "kg", label: "Kilograms" }]} />
        </FilterBar>
      </div>
      <Plot swap={`${win}${metric}`} label={`${title}, ${metric}: ${bars.map((b) => `${shortDate(b.day)} ${fmt(b.value)}`).join(", ")}.`} className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={w === 7 ? "30%" : "22%"}>
            <XAxis dataKey="label" {...axis} interval={w === 7 ? 0 : "preserveStartEnd"} minTickGap={6} />
            <Tooltip {...tooltipStyle} cursor={false} labelFormatter={(_, pl) => (pl?.[0] ? shortDate((pl[0].payload as Point).day) : "")} formatter={(v) => [fmt(Number(v)), ""]} />
            <Bar dataKey="value" barSize={w === 7 ? 14 : 10} radius={999} background={{ fill: "rgba(23,17,35,0.07)", radius: 999 }} animationDuration={900}>
              {bars.map((r, i) => <Cell key={r.day} fill={i === bars.length - 1 ? VIOLET : ORCHID} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      {legend && (
        <ul className="mt-5 space-y-2.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-3 text-sm">
              <span aria-hidden className={cn("size-3.5 rounded-full border-[3px]", l.tone === "violet" ? "border-violet" : "border-orchid")} />
              <span className="flex-1">{l.label}</span>
              <span className="tnum font-semibold">{l.pct}%</span>
            </li>
          ))}
        </ul>
      )}
      <Takeaway>{best && best.value > 0 ? <>Busiest full day: <strong>{shortDate(best.day)}</strong> with {fmt(best.value)}.</> : `Nothing recorded in this window yet.`}</Takeaway>
    </div>
  )
}

// Category momentum: a row per category with a mini area, this month's weight and the change.
export function Momentum({ rows, monthLabel }: { rows: { key: Category; current: number; delta: number | null; series: number[] }[]; monthLabel: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const [sort, setSort] = useState<"weight" | "change" | "category">("weight")
  const sorted = [...rows].sort((a, b) =>
    sort === "weight" ? b.current - a.current : sort === "change" ? (b.delta ?? -Infinity) - (a.delta ?? -Infinity) : CATEGORIES.indexOf(a.key) - CATEGORIES.indexOf(b.key)
  )
  const rising = [...rows].filter((r) => r.delta !== null).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]
  return (
    <div>
      <FilterBar>
        <Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: "weight", label: "Heaviest" }, { value: "change", label: "Biggest rise" }, { value: "category", label: "Category" }]} />
      </FilterBar>
      <Plot swap={sort} label={`Category momentum for ${monthLabel}: ${sorted.map((r) => `${CATEGORY_LABEL[r.key]} ${kgFmt(r.current)}`).join(", ")}.`}>
        <ul className="divide-y divide-line">
          {sorted.map((r) => {
            const color = r.key === "cat4_compostable" ? VIOLET : CATEGORY_COLOR[r.key]
            const gid = `mo-${uid}-${r.key}`
            return (
              <li key={r.key} className="grid grid-cols-[minmax(6.5rem,1fr)_auto_auto] items-center gap-3 py-3 sm:grid-cols-[minmax(6.5rem,1fr)_4.5rem_5.5rem_auto] xl:grid-cols-[minmax(6.5rem,1fr)_8rem_6rem_auto]">
                <span className="flex min-w-0 items-center gap-2.5 text-sm">
                  <CategorySwatch category={r.key} className="size-3.5" />
                  <span className="truncate font-semibold">{CATEGORY_LABEL[r.key]}</span>
                </span>
                <span className="hidden h-10 sm:block" aria-hidden>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={r.series.slice(Math.max(0, r.series.findIndex((v) => v > 0))).map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 2, left: 0 }}>
                      <defs>
                        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} animationDuration={1000} />
                    </AreaChart>
                  </ResponsiveContainer>
                </span>
                <span className="tnum text-right text-sm font-semibold">{kgFmt(r.current)}</span>
                <span className="justify-self-end"><DeltaChip value={r.delta} label="vs previous month" /></span>
              </li>
            )
          })}
        </ul>
      </Plot>
      <Takeaway>{rising ? <>Fastest-moving stream in {monthLabel}: <strong>{CATEGORY_LABEL[rising.key]}</strong>, {(rising.delta ?? 0) >= 0 ? "up" : "down"} {Math.abs(rising.delta ?? 0).toFixed(1)}% on the month before. Mini charts show each month this year.</> : "Momentum appears once there are two months of data."}</Takeaway>
    </div>
  )
}

// Stacked pills per day by category, on tracks. Filters: window and categories.
export function StackedPills({ days }: { days: ({ day: string } & Record<Category, number>)[] }) {
  const h = useHatch()
  const [win, setWin] = useState<"7" | "14">(days.length >= 14 ? "14" : "7")
  const [hidden, setHidden] = useState<Category[]>([])
  const cats = visibleItems(CATEGORIES, hidden)
  const rows = days.slice(-Number(win)).map((d) => ({ ...d, label: shortDate(d.day), total: sumBy(cats, (c) => d[c]) }))
  const peak = rows.reduce((a, b) => (b.total > a.total ? b : a), rows[0] ?? { label: "", total: 0 })
  const avg = rows.length ? sumBy(rows, (r) => r.total) / rows.length : 0
  return (
    <div>
      <FilterBar>
        {days.length > 7 && <Segmented label="Window" value={win} onChange={setWin} options={[{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }]} />}
        <CategoryChips hidden={hidden} onChange={setHidden} />
      </FilterBar>
      <Plot swap={`${win}${cats}`} label={`Daily collection over ${rows.length} days for ${cats.map((c) => CATEGORY_LABEL[c]).join(", ")}. Peak ${peak.label}, ${kgFmt(peak.total)}.`} className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -12 }} barCategoryGap="28%">
            {h.def}
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axis} width={44} />
            <ReferenceLine y={+avg.toFixed(2)} stroke={VIOLET} strokeDasharray="3 4" label={{ value: "avg", position: "right", fill: VIOLET, fontSize: 11 }} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.06)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {cats.map((c, i) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="d"
                barSize={14}
                fill={h.fill(c)}
                stroke={c === "cat4_compostable" ? VIOLET : SNOW}
                strokeWidth={1}
                radius={4}
                background={i === 0 ? { fill: "rgba(23,17,35,0.05)", radius: 999 } : undefined}
                animationDuration={900}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>{peak.total > 0 ? <>Peak day <strong>{peak.label}</strong> at {kgFmt(peak.total)}; the dashed line is the daily average, {kgFmt(avg)}.</> : "No collection for these categories in this window."}</Takeaway>
    </div>
  )
}

// A line with its value printed on every point. Filter: measure (kg / scans).
export function LabeledLine({ data }: { data: DayPoint[] }) {
  const [metric, setMetric] = useState<"kg" | "scans">("kg")
  const val = (d: DayPoint) => (metric === "kg" ? +d.kg.toFixed(2) : d.scans)
  const format = (v: number) => (metric === "kg" ? v.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : numFmt(v))
  const unit = metric === "kg" ? "kg" : "scans"
  const rows = data.map((d) => ({ day: d.day, value: val(d), label: shortDay(d.day) }))
  const best = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0] ?? { day: "", value: 0, label: "" })
  const low = rows.reduce((a, b) => (b.value < a.value ? b : a), rows[0] ?? { day: "", value: 0, label: "" })
  return (
    <div>
      <FilterBar>
        <Segmented label="Measure" value={metric} onChange={setMetric} options={[{ value: "kg", label: "Kilograms" }, { value: "scans", label: "Scans" }]} />
      </FilterBar>
      <Plot swap={metric} label={`${unit} per day: ${rows.map((d) => `${shortDate(d.day)} ${format(d.value)}`).join(", ")}.`} className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 28, right: 18, bottom: 0, left: 18 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axis} />
            <YAxis hide domain={[0, (m: number) => m * 1.25]} />
            <Tooltip {...tooltipStyle} labelFormatter={(_, pl) => (pl?.[0] ? shortDate((pl[0].payload as Point).day) : "")} formatter={(v) => [format(Number(v)), unit]} />
            <Line type="monotone" dataKey="value" stroke={VIOLET} strokeWidth={2.5} dot={{ r: 4, fill: SNOW, stroke: VIOLET, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1000}>
              <LabelList dataKey="value" position="top" offset={10} formatter={(v) => format(Number(v))} style={{ fill: NIGHT, fontSize: 11, fontWeight: 600 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </Plot>
      <Takeaway>{rows.length > 1 && best.value > 0 ? <>Best day <strong>{shortDate(best.day)}</strong> ({format(best.value)} {unit}), quietest {shortDate(low.day)} ({format(low.value)} {unit}).</> : `No ${unit} yet.`}</Takeaway>
    </div>
  )
}
