"use client"

// Charts on the neumorphic Night ground. Four colours only: Snow, Orchid, Violet (+ a hatched Violet
// for Category IV, so no series depends on colour alone). Every chart carries a plain-language
// takeaway under it and an aria-label summary, so the conclusion is readable without the picture.
import { useId } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, cityName, type Category } from "@/lib/shared"
import { cityCounts, cumulativePace, scoreBuckets, shares } from "@/lib/chart-math"
import { CategorySwatch } from "./ui"

const SNOW = "#FBFBFB"
const VIOLET = "#6F2DBD"
const ORCHID = "#A663CC"
const DIM = "rgba(251,251,251,0.7)"
const GRID = "rgba(251,251,251,0.08)"
const axis = { stroke: DIM, fontSize: 12, tickLine: false, axisLine: false } as const
const tooltipStyle = {
  contentStyle: {
    borderRadius: 14,
    background: "#171123",
    border: "1px solid rgba(166,99,204,0.45)",
    boxShadow: "-4px -4px 10px rgba(251,251,251,0.06), 6px 6px 16px #171123",
    fontSize: 13,
    color: SNOW,
  },
  labelStyle: { color: DIM },
  itemStyle: { color: SNOW },
}
const kgFmt = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`

// Category IV is hatched; a per-chart id keeps two charts on one page from sharing a pattern id.
function useHatch() {
  const id = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const def = (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill={VIOLET} />
        <line x1="0" y1="0" x2="0" y2="8" stroke={SNOW} strokeWidth="2" />
      </pattern>
    </defs>
  )
  return { def, fill: (c: Category) => (c === "cat4_compostable" ? `url(#${id})` : CATEGORY_COLOR[c]) }
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-sm text-ink">
      <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-orchid" />
      <span>{children}</span>
    </p>
  )
}

export function Legend({ cats = CATEGORIES }: { cats?: Category[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
      {cats.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <CategorySwatch category={c} /> {CATEGORY_LABEL[c]}
        </li>
      ))}
    </ul>
  )
}

// ── Monthly stacked bars ──────────────────────────────────────
export function TrendChart({ data }: { data: ({ month: string } & Record<Category, number>)[] }) {
  const h = useHatch()
  const totals = data.map((d) => ({ month: d.month, kg: CATEGORIES.reduce((a, c) => a + d[c], 0) }))
  const best = totals.reduce((a, b) => (b.kg > a.kg ? b : a), { month: "", kg: 0 })
  return (
    <div role="img" aria-label={`Kilograms collected per month by category. Busiest month: ${best.month || "none yet"}.`}>
      <Legend />
      <div className="h-60 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            {h.def}
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} width={48} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(166,99,204,0.1)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {CATEGORIES.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={h.fill(c)} radius={i === 3 ? [4, 4, 0, 0] : 0} animationDuration={700} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Takeaway>{best.kg > 0 ? <>Busiest month so far: <strong>{best.month}</strong>, {kgFmt(best.kg)}.</> : "No collection recorded this financial year yet."}</Takeaway>
    </div>
  )
}

// ── Category mix donut ────────────────────────────────────────
export function ShareDonut({ data, caption }: { data: { category: Category; kg: number }[]; caption?: string }) {
  const h = useHatch()
  const s = shares(data.map((d) => ({ key: d.category, kg: d.kg })))
  const slices = s.filter((r) => r.kg > 0)
  const total = s.reduce((a, r) => a + r.kg, 0)
  const top = s[0]
  return (
    <div role="img" aria-label={`Share of collection by category. ${s.map((r) => `${CATEGORY_LABEL[r.key]} ${r.pct}%`).join(", ")}.`}>
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative mx-auto aspect-square w-full max-w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {h.def}
              <Pie data={slices} dataKey="kg" nameKey="key" innerRadius="62%" outerRadius="100%" paddingAngle={2} cornerRadius={6} stroke="none" animationDuration={800}>
                {slices.map((r) => <Cell key={r.key} fill={h.fill(r.key)} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="eyebrow text-dim">Total</span>
            <span className="tnum font-display text-xl font-semibold">{kgFmt(total)}</span>
          </div>
        </div>
        <ul className="space-y-2.5">
          {s.map((r) => (
            <li key={r.key} className="flex items-center gap-3 text-sm">
              <CategorySwatch category={r.key} className="size-3.5" />
              <span className="flex-1">{CATEGORY_LABEL[r.key]}</span>
              <span className="tnum text-dim">{kgFmt(r.kg)}</span>
              <span className="tnum w-10 text-right font-semibold">{r.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      <Takeaway>
        {total > 0 ? (
          <><strong>{CATEGORY_LABEL[top.key]}</strong> makes up {top.pct}% of everything collected{caption ? ` ${caption}` : ""}.</>
        ) : (
          "Nothing collected in this period yet."
        )}
      </Takeaway>
    </div>
  )
}

// ── Cumulative collection vs target pace ──────────────────────
export function PaceChart({ monthly, target, elapsed }: { monthly: { month: string; kg: number }[]; target: number; elapsed: number }) {
  const p = cumulativePace(monthly, target, elapsed)
  const ahead = p.gap >= 0
  const fillId = `pace-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <div role="img" aria-label={`Cumulative collection against an even pace to the ${kgFmt(target)} target. ${ahead ? "Ahead" : "Behind"} by ${kgFmt(Math.abs(p.gap))} as of ${p.asOf ?? "now"}.`}>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-4 bg-snow" /> Collected so far</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block w-4 border-t-2 border-dashed border-orchid" /> Even pace to target</li>
      </ul>
      <div className="h-56 lg:h-64">
        <ResponsiveContainer width="100%" height="100%">
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
            <Area dataKey="pace" stroke={ORCHID} strokeDasharray="6 4" strokeWidth={2} fill="none" animationDuration={800} />
            <Area dataKey="actual" stroke={SNOW} strokeWidth={2.5} fill={`url(#${fillId})`} connectNulls={false} animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Takeaway>
        {target <= 0 ? (
          "No target set for this financial year."
        ) : p.asOf ? (
          <>{ahead ? "Ahead of" : "Behind"} an even pace by <strong>{kgFmt(Math.abs(p.gap))}</strong> at the end of {p.asOf}. {ahead ? "On track." : "Collection needs to speed up to meet the target."}</>
        ) : (
          "The financial year hasn't started yet."
        )}
      </Takeaway>
    </div>
  )
}

// ── Progress to target, one ring per category ─────────────────
export function TargetRings({ rows }: { rows: { category: Category; collected_kg: number; target_kg: number }[] }) {
  const h = useHatch()
  const data = rows.map((r) => ({ ...r, name: CATEGORY_LABEL[r.category], pct: r.target_kg > 0 ? Math.min(100, Math.round((r.collected_kg / r.target_kg) * 100)) : 0 }))
  const lagging = data.filter((d) => d.target_kg > 0).sort((a, b) => a.pct - b.pct)[0]
  const rings = [...data].reverse() // first category on the outside ring
  return (
    <div role="img" aria-label={`Progress to target by category: ${data.map((d) => `${d.name} ${d.pct}%`).join(", ")}.`}>
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto aspect-square w-full max-w-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart data={rings} innerRadius="28%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={12}>
              {h.def}
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
              <RadialBar dataKey="pct" cornerRadius={8} background={{ fill: "rgba(251,251,251,0.06)" }} animationDuration={900}>
                {rings.map((d) => <Cell key={d.category} fill={h.fill(d.category)} />)}
              </RadialBar>
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2.5">
          {data.map((d) => (
            <li key={d.category} className="flex items-center gap-3 text-sm">
              <CategorySwatch category={d.category} className="size-3.5" />
              <span className="flex-1">{d.name}</span>
              <span className="tnum w-12 text-right font-semibold">{d.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
      <Takeaway>
        {lagging ? <>Furthest behind: <strong>{lagging.name}</strong> at {lagging.pct}% of its target. Rings run clockwise from the top; a full ring is 100%.</> : "No targets set."}
      </Takeaway>
    </div>
  )
}

// ── Trust-score distribution ──────────────────────────────────
export function ScoreHistogram({ scores, threshold = 60 }: { scores: (number | null)[]; threshold?: number }) {
  const b = scoreBuckets(scores, threshold)
  return (
    <div role="img" aria-label={`Trust scores of ${b.scored} bins in five bands. ${b.low} below the anomaly threshold of ${threshold}.`}>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-orchid" /> Below {threshold} (anomaly)</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-snow" /> {threshold} and above</li>
      </ul>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={b.bands} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="band" {...axis} />
            <YAxis {...axis} allowDecimals={false} width={40} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(166,99,204,0.1)" }} formatter={(v) => [`${v} bins`, "Bins"]} labelFormatter={(l) => `Score ${l}`} />
            <Bar dataKey="bins" radius={[6, 6, 0, 0]} animationDuration={800}>
              {b.bands.map((x) => <Cell key={x.band} fill={x.lo < threshold ? ORCHID : SNOW} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Takeaway>
        {b.scored === 0 ? (
          "No trust scores yet. Bins are scored nightly once they have 20+ scans."
        ) : (
          <><strong>{b.low}</strong> of {b.scored} scored bins {b.low === 1 ? "is" : "are"} below {threshold} and worth a look{b.unscored ? `; ${b.unscored} not scored yet` : ""}.</>
        )}
      </Takeaway>
    </div>
  )
}

// ── Bins per city ─────────────────────────────────────────────
export function CityBins({ bins }: { bins: { city: string; status: string }[] }) {
  const data = cityCounts(bins).map((r) => ({ ...r, name: cityName(r.city) }))
  const top = data[0]
  return (
    <div role="img" aria-label={`Bins per city: ${data.map((d) => `${d.name} ${d.active} active, ${d.revoked} revoked`).join("; ")}.`}>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-violet" /> Active</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-orchid" /> Revoked</li>
      </ul>
      <div style={{ height: Math.max(120, data.length * 48) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" {...axis} allowDecimals={false} />
            <YAxis type="category" dataKey="name" {...axis} width={72} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(166,99,204,0.1)" }} formatter={(v, n) => [`${v} bins`, n === "active" ? "Active" : "Revoked"]} />
            <Bar dataKey="active" stackId="s" fill={VIOLET} animationDuration={800} />
            <Bar dataKey="revoked" stackId="s" fill={ORCHID} radius={[0, 6, 6, 0]} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Takeaway>{top ? <><strong>{top.name}</strong> has the most bins: {top.active} active{top.revoked ? `, ${top.revoked} revoked` : ""}.</> : "No bins registered."}</Takeaway>
    </div>
  )
}

export type ForecastPoint = { month: string; actual: number | null; projected: number | null; band: [number, number] | null }

export function ForecastChart({ data, target, atRisk }: { data: ForecastPoint[]; target: number; atRisk?: boolean }) {
  return (
    <div className="h-60 lg:h-80" role="img" aria-label={`Actual and projected collection against a target of ${kgFmt(target)}. ${atRisk ? "Projected to fall short." : "Projected to meet the target."}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 56, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" {...axis} />
          <YAxis {...axis} width={48} domain={[0, (max: number) => Math.ceil(Math.max(max, target) * 1.1)]} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v, n) => {
              if (Array.isArray(v)) return [`${kgFmt(Number(v[0]))} – ${kgFmt(Number(v[1]))}`, "Range"]
              return [kgFmt(Number(v)), n === "actual" ? "Actual" : "Projection"]
            }}
          />
          <Area dataKey="band" stroke="none" fill={ORCHID} fillOpacity={0.18} animationDuration={700} connectNulls />
          <Line dataKey="actual" stroke={SNOW} strokeWidth={2} dot={false} animationDuration={700} />
          <Line dataKey="projected" stroke={ORCHID} strokeWidth={2} strokeDasharray="6 4" dot={false} animationDuration={700} connectNulls />
          <ReferenceLine
            y={target}
            stroke={atRisk ? ORCHID : DIM}
            strokeDasharray="2 3"
            strokeWidth={1.5}
            label={{ value: `Target ${kgFmt(target)}`, position: "insideTopRight", fill: atRisk ? ORCHID : DIM, fontSize: 12, fontWeight: 600 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScoreChart({ data }: { data: { day: string; score: number }[] }) {
  return (
    <div className="h-60" role="img" aria-label={`Trust score over time. Latest ${data.at(-1)?.score ?? "none"}; anomaly threshold 60.`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
          <YAxis {...axis} domain={[0, 100]} width={44} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v, "Trust score"]} />
          <ReferenceLine y={60} stroke={ORCHID} strokeDasharray="2 3" label={{ value: "Anomaly threshold", position: "insideBottomRight", fill: ORCHID, fontSize: 11 }} />
          <Line dataKey="score" stroke={SNOW} strokeWidth={2} dot={false} animationDuration={700} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
