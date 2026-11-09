"use client"

// Every step, in order, with where it came from: the server (real response and its own
// timestamps) or the simulated hardware (generated in this browser). Payloads expand.
import { cn } from "cn"
import { fmtTime } from "@/lib/format"

export type SimEvent = { id: number; at: string; label: string; source: "server" | "simulated" | "ledger"; tone?: "ok" | "bad" | "warn"; detail?: unknown }

const SOURCE = { server: "Server", ledger: "Ledger", simulated: "Simulated" } as const

export function Timeline({ events }: { events: SimEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-dim">Run a scenario. Every step will appear here with its real time and payload.</p>
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Event timeline">
      {events.map((e) => (
        <li key={e.id} className="feed-in rounded-[10px]">
          <details className="group rounded-[10px] px-2 py-1.5 open:bg-panel-hi">
            <summary className="flex cursor-pointer list-none items-center gap-3 text-sm">
              <span className="tnum w-[64px] shrink-0 text-xs text-dim">{fmtTime(e.at)}</span>
              <span
                className={cn(
                  "w-[74px] shrink-0 rounded-badge px-1.5 py-0.5 text-center text-[10px] font-semibold tracking-wider uppercase",
                  e.source === "simulated" ? "border border-dashed border-line-strong text-dim" : e.source === "ledger" ? "bg-violet text-snow" : "bg-night text-snow"
                )}
              >
                {SOURCE[e.source]}
              </span>
              <span className={cn("min-w-0 flex-1 font-medium", e.tone === "bad" && "font-semibold", e.tone === "ok" && "text-lit font-semibold")}>
                {e.tone === "ok" ? "✓ " : e.tone === "bad" ? "✗ " : e.tone === "warn" ? "⚠ " : ""}
                {e.label}
              </span>
              {e.detail != null && <span className="text-xs text-dim group-open:hidden">details</span>}
            </summary>
            {e.detail != null && (
              <pre className="mt-2 max-h-56 overflow-auto rounded-[8px] bg-chip p-2 font-mono text-[11px] leading-4 [overflow-wrap:anywhere] whitespace-pre-wrap">
                {JSON.stringify(e.detail, null, 2)}
              </pre>
            )}
          </details>
        </li>
      ))}
    </ol>
  )
}
