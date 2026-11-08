"use client"

import { useState } from "react"
import { cn } from "cn"
import { CATEGORY_LABEL, type Category } from "@/lib/shared"
import { kg } from "@/lib/format"
import { ForecastChart, type ForecastPoint } from "./charts"
import { Badge, CategorySwatch } from "./ui"

// All values in kg (backend units).
export type ForecastData = { category: Category; target_kg: number; projected_kg: number; low_kg: number; high_kg: number; collected_kg: number; at_risk: boolean; points: ForecastPoint[] }

export function ForecastTabs({ data }: { data: ForecastData[] }) {
  const [cat, setCat] = useState<Category>(data.find((d) => d.at_risk)?.category ?? data[0].category)
  const d = data.find((x) => x.category === cat)!
  return (
    <div>
      <div role="tablist" aria-label="Forecast category" className="mb-4 flex flex-wrap gap-2">
        {data.map((x) => (
          <button
            key={x.category}
            role="tab"
            aria-selected={x.category === cat}
            onClick={() => setCat(x.category)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              x.category === cat ? "border-olive-700 bg-olive-700 text-garden-50" : "border-sage-600 hover:bg-sage-200"
            )}
          >
            <CategorySwatch category={x.category} className="outline outline-1 outline-garden-50/40" />
            {CATEGORY_LABEL[x.category]}
            {x.at_risk && <span aria-label="at risk">⚠</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={`${CATEGORY_LABEL[cat]} forecast`}>
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>Collected <strong className="tnum">{kg(d.collected_kg)}</strong></span>
          <span>Projected <strong className="tnum">{kg(d.projected_kg)}</strong> <span className="text-olive-700">({kg(d.low_kg)} – {kg(d.high_kg)})</span></span>
          <span>Target <strong className="tnum">{kg(d.target_kg)}</strong></span>
          {d.at_risk ? <Badge kind="warning">⚠ At risk</Badge> : <Badge kind="ok">✓ On track</Badge>}
        </div>
        <ForecastChart data={d.points} target={d.target_kg} atRisk={d.at_risk} />
        <p className="mt-3 text-xs text-olive-700">Solid: collected (kg, cumulative). Dashed: projection at the last 8 weeks&apos; pace. Band: likely range. Dotted: FY target.</p>
      </div>
    </div>
  )
}
