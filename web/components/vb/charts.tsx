"use client"

// Charts on the light neumorphic ground. Four colours only: Night, Violet, Orchid (+ a Violet-hatched
// Snow for Category IV, so no series depends on colour alone). Every chart carries a plain-language
// takeaway under it and an aria-label summary, so the conclusion is readable without the picture.
import { useId } from "react"
import { cn } from "cn"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, cityName, type Category } from "@/lib/shared"
import { cityCounts, cumulativePace, sankeyFlow, scoreBuckets, shares } from "@/lib/chart-math"
import { CategorySwatch, DeltaChip } from "./ui"
import { CountUp } from "./count-up"

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
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
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
              <Pie data={slices} dataKey="kg" nameKey="key" innerRadius="74%" outerRadius="100%" paddingAngle={3} cornerRadius={8} stroke="none" animationDuration={800}>
                {slices.map((r) => <Cell key={r.key} fill={h.fill(r.key)} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="eyebrow text-dim">Total</span>
            <CountUp value={kgFmt(total)} className="tnum font-display text-xl font-semibold" />
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
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-4 bg-violet" /> Collected so far</li>
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
            <Area type="monotone" dataKey="pace" stroke={ORCHID} strokeDasharray="6 4" strokeWidth={2} fill="none" animationDuration={800} />
            <Area type="monotone" dataKey="actual" stroke={VIOLET} strokeWidth={2.5} fill={`url(#${fillId})`} connectNulls={false} animationDuration={1100} activeDot={{ r: 5, fill: SNOW, stroke: VIOLET, strokeWidth: 2 }} />
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
              <RadialBar dataKey="pct" cornerRadius={8} background={{ fill: "rgba(23,17,35,0.06)" }} animationDuration={900}>
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
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-3 rounded-[3px] bg-violet" /> {threshold} and above</li>
      </ul>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={b.bands} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="band" {...axis} />
            <YAxis {...axis} allowDecimals={false} width={40} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v) => [`${v} bins`, "Bins"]} labelFormatter={(l) => `Score ${l}`} />
            <Bar dataKey="bins" radius={[6, 6, 0, 0]} animationDuration={800}>
              {b.bands.map((x) => <Cell key={x.band} fill={x.lo < threshold ? ORCHID : VIOLET} />)}
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
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v, n) => [`${v} bins`, n === "active" ? "Active" : "Revoked"]} />
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
          <ReferenceLine y={60} stroke={VIOLET} strokeDasharray="2 3" label={{ value: "Anomaly threshold", position: "insideBottomRight", fill: VIOLET, fontSize: 11 }} />
          <Line dataKey="score" stroke={NIGHT} strokeWidth={2} dot={false} animationDuration={700} />
        </LineChart>
      </ResponsiveContainer>
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
  const g = sankeyFlow(rows, { category: (c) => CATEGORY_LABEL[c as Category] ?? c, city: (c) => cityName(c) })
  const perColumn = [0, 1, 2].map((c) => g.nodes.filter((n) => n.column === c).length)
  // Every node gets room for its two-line label (name + kg); small streams never collide or clip.
  const height = Math.max(320, Math.max(...perColumn) * 84)
  const total = g.nodes.filter((n) => n.column === 0).reduce((a, n) => a + n.kg, 0)
  const fill = (n: NodeP["payload"]) => (n.column === 0 ? VIOLET : n.column === 2 ? NIGHT : h.fill(n.id.slice(4) as Category))
  // Each band carries the colour of its EPR category, so a stream can be followed end to end.
  const bandCategory = (l: LinkP["payload"]) => (l.source.column === 1 ? l.source.id : l.target.id).slice(4) as Category
  if (g.links.length === 0) return <p className="text-sm text-dim">Nothing collected in this period, so there is no flow to show.</p>
  return (
    <div role="img" aria-label={`Flow of ${kgFmt(total)} collected waste from ${perColumn[0]} companies through ${perColumn[1]} categories to ${perColumn[2]} cities.`}>
      <Legend />
      <div className="mb-2 grid grid-cols-3 text-xs font-semibold tracking-[0.12em] text-dim uppercase">
        <span>Produced by</span>
        <span className="text-center">EPR category</span>
        <span className="text-right">Collected in</span>
      </div>
      <div className="-mx-2 overflow-x-auto px-2">
        <div className="min-w-[620px]" style={{ height }}>
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
                    className="transition-[stroke-opacity] duration-200 hover:[stroke-opacity:0.55]"
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
        </div>
      </div>
      <Takeaway>Read left to right: who produced the waste, which EPR category it falls in, and which city&apos;s bins collected it. Band width is weight; band colour is the category.</Takeaway>
    </div>
  )
}

// ── One stacked bar per company / city / anything, split by category ──
export function CategoryStack({ data, takeaway, label }: { data: ({ key: string; name: string; total: number } & Record<string, number | string>)[]; takeaway: React.ReactNode; label: string }) {
  const h = useHatch()
  return (
    <div role="img" aria-label={`${label}: ${data.map((d) => `${d.name} ${kgFmt(Number(d.total))}`).join(", ")}.`}>
      <Legend />
      <div style={{ height: Math.max(140, data.length * 52) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
            {h.def}
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="name" {...axis} width={128} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.08)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {CATEGORIES.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="s" fill={h.fill(c)} stroke={c === "cat4_compostable" ? VIOLET : undefined} radius={i === 3 ? [0, 6, 6, 0] : 0} animationDuration={800} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Takeaway>{takeaway}</Takeaway>
    </div>
  )
}

// ── Top products by collected weight ──────────────────────────
export function ProductBars({ products }: { products: { name: string; company?: string; category: Category; kg: number; scans: number }[] }) {
  const h = useHatch()
  const data = products.slice(0, 10).map((p) => ({ ...p, label: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name }))
  const total = products.reduce((a, p) => a + p.kg, 0)
  const top = data[0]
  return (
    <div role="img" aria-label={`Top ${data.length} products by collected weight. ${top ? `${top.name} leads with ${kgFmt(top.kg)}.` : ""}`}>
      <Legend />
      <div style={{ height: Math.max(140, data.length * 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
            {h.def}
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="label" {...axis} width={150} />
            <Tooltip
              {...tooltipStyle}
              cursor={{ fill: "rgba(111,45,189,0.08)" }}
              formatter={(v, _n, item) => [`${kgFmt(Number(v))} · ${(item.payload as { scans: number }).scans.toLocaleString("en-IN")} scans`, (item.payload as { company?: string }).company ?? CATEGORY_LABEL[(item.payload as { category: Category }).category]]}
            />
            <Bar dataKey="kg" radius={[0, 6, 6, 0]} animationDuration={800}>
              {data.map((p) => <Cell key={p.name + (p.company ?? "")} fill={h.fill(p.category)} stroke={p.category === "cat4_compostable" ? VIOLET : undefined} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Takeaway>
        {top ? <><strong>{top.name}</strong> is the most-collected product: {kgFmt(top.kg)}, {total > 0 ? Math.round((top.kg / total) * 100) : 0}% of product-level waste.</> : "No product scans in this period."}
      </Takeaway>
    </div>
  )
}

// ── Reference-style cards ─────────────────────────────────────
type Point = { day: string; value: number }
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }).slice(0, 2)
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })

// Filled Violet headline card: big number, change badge, 30-day sparkline, soft Orchid circles.
export function HeroStat({ label, value, caption, delta, deltaLabel, spark }: { label: string; value: string; caption: string; delta: number | null; deltaLabel: string; spark: Point[] }) {
  const id = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  return (
    <div className="btn-lit relative isolate flex h-full flex-col justify-between overflow-hidden rounded-card p-5 text-snow sm:p-6" role="group" aria-label={`${label}: ${value}`}>
      <span aria-hidden className="absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-orchid/35 float-slow" />
      <span aria-hidden className="absolute -top-4 right-16 -z-10 size-28 rounded-full bg-snow/10 float-slow [animation-delay:-4s]" />
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-snow/85">{label}</p>
        <DeltaChip value={delta} label={deltaLabel} tone="onViolet" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-[34px] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap lg:text-[40px]"><CountUp value={value} className="tnum" /></p>
          <p className="mt-2 text-sm text-snow/85">{caption}</p>
        </div>
        <div className="h-14 w-28 shrink-0 sm:w-40" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SNOW} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={SNOW} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={SNOW} strokeWidth={2} fill={`url(#${id})`} animationDuration={1200} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// Pill bars on tracks: one bar per day, today in Violet. Header carries the total and the change.
export function PillBars({ title, subtitle, total, delta, deltaLabel, data, unit, legend }: {
  title: string
  subtitle: string
  total: string
  delta: number | null
  deltaLabel: string
  data: Point[]
  unit: string
  legend?: { label: string; pct: number; tone: "violet" | "orchid" }[]
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const rows = data.map((d) => ({ ...d, label: shortDay(d.day), track: max }))
  const best = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] ?? { day: "", value: 0 })
  return (
    <div role="img" aria-label={`${title}: ${total}. ${data.map((d) => `${shortDate(d.day)} ${d.value} ${unit}`).join(", ")}.`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-h3">{title}</p>
          <p className="text-sm text-dim">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="tnum font-display text-2xl font-semibold"><CountUp value={total} /></p>
          <DeltaChip value={delta} label={deltaLabel} />
        </div>
      </div>
      <div className="mt-6 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="30%">
            <XAxis dataKey="label" {...axis} />
            <Tooltip {...tooltipStyle} cursor={false} labelFormatter={(_, pl) => (pl?.[0] ? shortDate((pl[0].payload as Point).day) : "")} formatter={(v) => [`${Number(v).toLocaleString("en-IN")} ${unit}`, ""]} />
            <Bar dataKey="value" barSize={14} radius={999} background={{ fill: "rgba(23,17,35,0.07)", radius: 999 }} animationDuration={900}>
              {rows.map((r, i) => <Cell key={r.day} fill={i === rows.length - 1 ? VIOLET : ORCHID} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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
      <Takeaway>{best && best.value > 0 ? <>Busiest day: <strong>{shortDate(best.day)}</strong> with {best.value.toLocaleString("en-IN")} {unit}. Today, still in progress, is the Violet bar.</> : `No ${unit} in this window yet.`}</Takeaway>
    </div>
  )
}

// Category momentum: a row per category with a mini area, this month's weight and the change.
export function Momentum({ rows, monthLabel }: { rows: { key: Category; current: number; delta: number | null; series: number[] }[]; monthLabel: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const rising = [...rows].filter((r) => r.delta !== null).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]
  return (
    <div role="img" aria-label={`Category momentum for ${monthLabel}: ${rows.map((r) => `${CATEGORY_LABEL[r.key]} ${kgFmt(r.current)}`).join(", ")}.`}>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const color = r.key === "cat4_compostable" ? VIOLET : CATEGORY_COLOR[r.key]
          const gid = `mo-${uid}-${r.key}`
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_auto]">
              <span className="flex min-w-0 items-center gap-2.5 text-sm">
                <CategorySwatch category={r.key} className="size-3.5" />
                <span className="truncate font-semibold">{CATEGORY_LABEL[r.key]}</span>
              </span>
              <span className="hidden h-10 sm:block" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.series.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 2, left: 0 }}>
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
      <Takeaway>{rising ? <>Fastest-moving stream in {monthLabel}: <strong>{CATEGORY_LABEL[rising.key]}</strong>, {(rising.delta ?? 0) >= 0 ? "up" : "down"} {Math.abs(rising.delta ?? 0).toFixed(1)}% on the month before.</> : "Momentum appears once there are two months of data."}</Takeaway>
    </div>
  )
}

// Stacked pills per day by category, on tracks.
export function StackedPills({ days }: { days: ({ day: string } & Record<Category, number>)[] }) {
  const h = useHatch()
  const rows = days.map((d) => ({ ...d, label: shortDate(d.day), total: CATEGORIES.reduce((a, c) => a + d[c], 0) }))
  const peak = rows.reduce((a, b) => (b.total > a.total ? b : a), rows[0] ?? { label: "", total: 0 })
  const avg = rows.length ? rows.reduce((a, r) => a + r.total, 0) / rows.length : 0
  return (
    <div role="img" aria-label={`Daily collection by category over ${rows.length} days. Peak ${peak.label}, ${kgFmt(peak.total)}.`}>
      <Legend />
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -12 }} barCategoryGap="28%">
            {h.def}
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={12} />
            <YAxis {...axis} width={44} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(111,45,189,0.06)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {CATEGORIES.map((c, i) => (
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
      </div>
      <Takeaway>{peak.total > 0 ? <>Peak day <strong>{peak.label}</strong> at {kgFmt(peak.total)}, against a daily average of {kgFmt(avg)}.</> : "No collection in this window."}</Takeaway>
    </div>
  )
}

// A line with its value printed on every point (the last 7 days, readable without hovering).
// Props stay serialisable (server pages render this), so the number format is a decimals count.
export function LabeledLine({ data, unit, decimals = 1 }: { data: Point[]; unit: string; decimals?: number }) {
  const format = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const rows = data.map((d) => ({ ...d, label: shortDay(d.day) }))
  const first = data[0]?.value ?? 0
  const last = data.at(-1)?.value ?? 0
  return (
    <div role="img" aria-label={`${unit} per day: ${data.map((d) => `${shortDate(d.day)} ${format(d.value)}`).join(", ")}.`}>
      <div className="h-48">
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
      </div>
      <Takeaway>{data.length > 1 ? <>Across the week, daily {unit} went from {format(first)} to {format(last)}.</> : `No ${unit} yet.`}</Takeaway>
    </div>
  )
}
