"use client"

// The bin's load cell, simulated. A half-dial from 0 g to 4.5x the catalogue weight, with the
// backend's tolerance band (max 3 g, 30%) drawn in, so the judge sees why a weight is in or out.
import { tolerance, withinTolerance } from "@/lib/sim-machine"

const R = 80
const polar = (f: number) => {
  const a = Math.PI * (1 - Math.min(Math.max(f, 0), 1))
  return [100 + R * Math.cos(a), 100 - R * Math.sin(a)] as const
}
const arc = (from: number, to: number) => {
  const [x1, y1] = polar(from)
  const [x2, y2] = polar(to)
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`
}

export function Scale({ weight, expected, active }: { weight: number | null; expected: number; active: boolean }) {
  const max = Math.max(expected * 4.5, 10)
  const tol = tolerance(expected)
  const shown = weight ?? 0
  const [nx, ny] = polar(shown / max)
  const ok = weight != null && weight > 0 && withinTolerance(weight, expected)
  return (
    <div className="neu-inset rounded-[14px] p-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-dim">Scale · simulated</p>
        <span className="tnum text-xs text-dim">expects {expected} g ± {Math.round(tol * 10) / 10} g</span>
      </div>
      <svg viewBox="0 0 200 112" className="mx-auto mt-1 w-full max-w-[240px]" role="img" aria-label={`Scale reads ${shown} grams`}>
        <path d={arc(0, 1)} fill="none" stroke="var(--chip)" strokeWidth="12" strokeLinecap="round" />
        <path d={arc((expected - tol) / max, (expected + tol) / max)} fill="none" stroke="var(--orchid)" strokeWidth="12" />
        <line x1="100" y1="100" x2={nx} y2={ny} stroke="var(--night)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="6" fill="var(--night)" />
      </svg>
      <div className="flex items-baseline justify-between">
        <span className="t-kpi tnum text-2xl">{active || weight != null ? `${shown} g` : "—"}</span>
        <span className="text-xs font-semibold">
          {weight == null ? <span className="text-dim">Baseline 0 g</span> : weight === 0 ? "No change" : ok ? "✓ Within tolerance" : "⚠ Outside tolerance"}
        </span>
      </div>
    </div>
  )
}
