"use client"

// What the bin's camera "sees". Generated in the browser and labelled SIMULATED: in a real bin
// this is the camera's own detection result; here it only shows what the judge chose.
import { cn } from "cn"

export type CameraPhase = "standby" | "watching" | "seen" | "nothing"

export function CameraView({ phase, itemName, at }: { phase: CameraPhase; itemName: string; at: string | null }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-night text-snow" aria-live="polite">
      <div className="sim-scan-bg absolute inset-0 opacity-40" aria-hidden />
      <div className="absolute inset-x-3 top-2 flex items-center justify-between text-[10px] font-semibold tracking-[0.14em] uppercase">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", phase === "standby" ? "bg-dim" : "soft-pulse bg-orchid")} />
          Cam-01 · simulated
        </span>
        <span className="tnum opacity-70">{at ?? "--:--:--"}</span>
      </div>

      {/* the bin opening, seen from above, and the line an item must cross */}
      <div className="absolute inset-x-[18%] top-[30%] bottom-[18%] rounded-[10px] border-2 border-dashed border-snow/30" aria-hidden />
      <div className="absolute inset-x-[12%] top-[58%] h-px bg-orchid/70" aria-hidden />
      <span className="absolute top-[52%] left-[13%] text-[9px] tracking-widest text-orchid/90 uppercase" aria-hidden>opening line</span>

      {(phase === "watching" || phase === "seen") && (
        <div className={cn("absolute left-1/2 w-[22%] -translate-x-1/2", phase === "watching" ? "sim-cam-fall" : "top-[48%]")}>
          <div className={cn("aspect-[3/4] rounded-[8px] border-2", phase === "seen" ? "border-orchid bg-orchid/25" : "border-snow/60 bg-snow/10")} />
          {phase === "seen" && (
            <span className="absolute -top-5 left-0 rounded bg-orchid px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-night">
              {itemName} · crossed
            </span>
          )}
        </div>
      )}

      <p className="absolute inset-x-3 bottom-2 text-xs font-semibold">
        {phase === "standby" && "Waiting for the lid to open"}
        {phase === "watching" && "Watching the opening…"}
        {phase === "seen" && "✓ An item crossed the opening line"}
        {phase === "nothing" && "✗ Nothing crossed the opening"}
      </p>
    </div>
  )
}
