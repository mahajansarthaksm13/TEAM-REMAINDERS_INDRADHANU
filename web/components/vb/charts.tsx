"use client"

// Flat charts, Sage Mist gridlines, category colours per Design Brief §5 / Spec §A1.
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, type Category } from "@/lib/shared"
import { CategorySwatch } from "./ui"

const axis = { stroke: "#4A543D", fontSize: 12, tickLine: false, axisLine: false } as const
const tooltipStyle = { contentStyle: { borderRadius: 14, border: "1px solid #D7DEC8", boxShadow: "0 4px 16px rgba(31,38,26,0.08)", fontSize: 13 } }
const kgFmt = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`

function Hatch() {
  return (
    <defs>
      <pattern id="hatch-iv" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#D7DEC8" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#4A543D" strokeWidth="2" />
      </pattern>
    </defs>
  )
}

export function Legend({ cats = CATEGORIES }: { cats?: Category[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-olive-700">
      {cats.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <CategorySwatch category={c} /> {CATEGORY_LABEL[c]}
        </li>
      ))}
    </ul>
  )
}

export function TrendChart({ data }: { data: ({ month: string } & Record<Category, number>)[] }) {
  return (
    <div>
      <Legend />
      <div className="h-60 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <Hatch />
            <CartesianGrid vertical={false} stroke="#D7DEC8" />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} width={48} tickFormatter={(v) => `${v}`} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "#F5F7EF" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {CATEGORIES.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={c === "cat4_compostable" ? "url(#hatch-iv)" : CATEGORY_COLOR[c]} radius={i === 3 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-olive-700">Kilograms collected per month, financial year April–March.</p>
    </div>
  )
}

export type ForecastPoint = { month: string; actual: number | null; projected: number | null; band: [number, number] | null }

export function ForecastChart({ data, target, atRisk }: { data: ForecastPoint[]; target: number; atRisk?: boolean }) {
  return (
    <div className="h-60 lg:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 56, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="#D7DEC8" />
          <XAxis dataKey="month" {...axis} />
          <YAxis {...axis} width={48} domain={[0, (max: number) => Math.ceil(Math.max(max, target) * 1.1)]} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v, n) => {
              if (Array.isArray(v)) return [`${kgFmt(Number(v[0]))} – ${kgFmt(Number(v[1]))}`, "Range"]
              return [kgFmt(Number(v)), n === "actual" ? "Actual" : "Projection"]
            }}
          />
          <Area dataKey="band" stroke="none" fill="#D7DEC8" fillOpacity={0.6} isAnimationActive={false} connectNulls />
          <Line dataKey="actual" stroke="#1F261A" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="projected" stroke="#4A543D" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
          <ReferenceLine
            y={target}
            stroke={atRisk ? "#8A6414" : "#1F261A"}
            strokeDasharray="2 3"
            strokeWidth={1.5}
            label={{ value: `Target ${kgFmt(target)}`, position: "insideTopRight", fill: atRisk ? "#8A6414" : "#1F261A", fontSize: 12, fontWeight: 600 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScoreChart({ data }: { data: { day: string; score: number }[] }) {
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid vertical={false} stroke="#D7DEC8" />
          <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
          <YAxis {...axis} domain={[0, 100]} width={44} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v, "Trust score"]} />
          <ReferenceLine y={60} stroke="#8A6414" strokeDasharray="2 3" label={{ value: "Anomaly threshold", position: "insideBottomRight", fill: "#8A6414", fontSize: 11 }} />
          <Line dataKey="score" stroke="#1F261A" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
