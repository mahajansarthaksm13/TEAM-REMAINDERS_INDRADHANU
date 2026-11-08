"use client"

// Flat charts on the dark ground: Deep Olive gridlines, Muted Sage axes, Garden White data.
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, type Category } from "@/lib/shared"
import { CategorySwatch } from "./ui"

const axis = { stroke: "#A7B194", fontSize: 12, tickLine: false, axisLine: false } as const
const GRID = "#3A4532"
const tooltipStyle = {
  contentStyle: { borderRadius: 14, background: "#283121", border: "1px solid #3A4532", boxShadow: "0 18px 40px -14px rgba(0,0,0,0.75)", fontSize: 13, color: "#F5F7EF" },
  labelStyle: { color: "#A7B194" },
  itemStyle: { color: "#F5F7EF" },
}
const kgFmt = (v: number) => `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`

function Hatch() {
  return (
    <defs>
      <pattern id="hatch-iv" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#4A543D" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#D7DEC8" strokeWidth="2" />
      </pattern>
    </defs>
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

export function TrendChart({ data }: { data: ({ month: string } & Record<Category, number>)[] }) {
  return (
    <div>
      <Legend />
      <div className="h-60 lg:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <Hatch />
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} width={48} tickFormatter={(v) => `${v}`} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(215,222,200,0.06)" }} formatter={(v, n) => [kgFmt(Number(v)), CATEGORY_LABEL[n as Category]]} />
            {CATEGORIES.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={c === "cat4_compostable" ? "url(#hatch-iv)" : CATEGORY_COLOR[c]} radius={i === 3 ? [4, 4, 0, 0] : 0} animationDuration={700} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-dim">Kilograms collected per month, financial year April–March.</p>
    </div>
  )
}

export type ForecastPoint = { month: string; actual: number | null; projected: number | null; band: [number, number] | null }

export function ForecastChart({ data, target, atRisk }: { data: ForecastPoint[]; target: number; atRisk?: boolean }) {
  return (
    <div className="h-60 lg:h-80">
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
          <Area dataKey="band" stroke="none" fill="#D7DEC8" fillOpacity={0.14} animationDuration={700} connectNulls />
          <Line dataKey="actual" stroke="#F5F7EF" strokeWidth={2} dot={false} animationDuration={700} />
          <Line dataKey="projected" stroke="#D7DEC8" strokeWidth={2} strokeDasharray="6 4" dot={false} animationDuration={700} connectNulls />
          <ReferenceLine
            y={target}
            stroke={atRisk ? "#E3BC62" : "#A7B194"}
            strokeDasharray="2 3"
            strokeWidth={1.5}
            label={{ value: `Target ${kgFmt(target)}`, position: "insideTopRight", fill: atRisk ? "#E3BC62" : "#A7B194", fontSize: 12, fontWeight: 600 }}
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
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
          <YAxis {...axis} domain={[0, 100]} width={44} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v, "Trust score"]} />
          <ReferenceLine y={60} stroke="#E3BC62" strokeDasharray="2 3" label={{ value: "Anomaly threshold", position: "insideBottomRight", fill: "#E3BC62", fontSize: 11 }} />
          <Line dataKey="score" stroke="#F5F7EF" strokeWidth={2} dot={false} animationDuration={700} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
