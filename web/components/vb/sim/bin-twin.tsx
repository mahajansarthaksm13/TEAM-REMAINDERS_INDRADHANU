"use client"

// The smart bin, drawn in SVG and driven only by the state machine (lib/sim-machine.ts).
// Lid, scanner light, camera and the item are separate parts so each state change is visible:
// locked (shut, shakes on a refused code), opening/open (lid swings up), deposit (item drops
// through the opening past the camera), closing (lid comes down).
import { cn } from "cn"
import type { SimState } from "@/lib/sim-machine"
import type { Category } from "@/lib/shared"

export type Drop = "none" | "above" | "falling" | "inside" | "hovering"

const LID_UP = new Set<SimState>(["OPENING", "OPEN", "DEPOSIT_IN_PROGRESS", "CAMERA_VERIFYING", "WEIGHT_CHECKING", "APPROVED", "REJECTED", "REVIEW_REQUIRED"])

function Item({ category }: { category: Category }) {
  // One silhouette per EPR category: bottle, pouch, sachet, cup.
  switch (category) {
    case "cat2_flexible":
      return <path d="M-14 -20 L14 -20 L12 20 Q0 26 -12 20 Z" fill="var(--orchid)" stroke="var(--night)" strokeWidth="2" />
    case "cat3_multilayer":
      return <rect x="-12" y="-16" width="24" height="32" rx="3" fill="var(--violet)" stroke="var(--night)" strokeWidth="2" />
    case "cat4_compostable":
      return <path d="M-14 -18 L14 -18 L9 20 L-9 20 Z" fill="var(--snow)" stroke="var(--night)" strokeWidth="2" />
    default:
      return (
        <g stroke="var(--night)" strokeWidth="2">
          <rect x="-5" y="-30" width="10" height="8" rx="2" fill="var(--night)" />
          <path d="M-5 -22 Q-12 -16 -12 -8 L-12 22 Q-12 26 -8 26 L8 26 Q12 26 12 22 L12 -8 Q12 -16 5 -22 Z" fill="var(--orchid)" />
        </g>
      )
  }
}

export function BinTwin({ state, drop, category, refused }: { state: SimState; drop: Drop; category: Category; refused: boolean }) {
  const lidUp = LID_UP.has(state)
  const scanning = state === "QR_SCANNED" || state === "VALIDATING"
  const watching = state === "DEPOSIT_IN_PROGRESS" || state === "CAMERA_VERIFYING"
  const led = refused ? "var(--night)" : scanning ? "var(--orchid)" : lidUp ? "var(--violet)" : "var(--line-strong)"

  return (
    <svg viewBox="0 0 280 360" role="img" aria-label={`Smart bin, lid ${lidUp ? "open" : "closed"}`} className={cn("h-auto w-full max-w-[320px] drop-shadow-[0_18px_24px_rgba(23,17,35,0.18)]", refused && "sim-shake")}>
      {/* floor shadow */}
      <ellipse cx="140" cy="340" rx="104" ry="10" fill="var(--night)" opacity="0.12" />

      {/* camera mast + dome, looking down at the opening */}
      <rect x="196" y="52" width="6" height="58" rx="3" fill="var(--line-strong)" />
      <g transform="translate(199 48)">
        <circle r="13" fill="var(--night)" />
        <circle r="6" fill={watching ? "var(--orchid)" : "var(--dim)"} className={cn(watching && "sim-blink")} />
        <circle cx="9" cy="-9" r="3" fill={watching ? "var(--violet)" : "transparent"} />
      </g>
      {watching && <path d="M199 61 L150 112 L248 112 Z" fill="var(--orchid)" opacity="0.14" />}

      {/* item above / falling / inside */}
      {drop !== "none" && (
        <g className={cn("sim-item", `sim-item-${drop}`)} style={{ transformBox: "view-box" }}>
          <g transform="translate(140 40)">
            <Item category={category} />
          </g>
        </g>
      )}

      {/* body */}
      <path d="M52 118 L228 118 L214 326 Q213 334 205 334 L75 334 Q67 334 66 326 Z" fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="M58 132 L222 132 L220 160 L60 160 Z" fill="var(--chip)" />
      <text x="140" y="151" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--violet)" letterSpacing="2">VERIBIN</text>
      {/* category stripes */}
      {["var(--night)", "var(--violet)", "var(--orchid)", "var(--line-strong)"].map((c, i) => (
        <rect key={c} x={92 + i * 26} y="300" width="20" height="6" rx="3" fill={c} />
      ))}

      {/* scanner panel with status light */}
      <rect x="92" y="186" width="96" height="70" rx="12" fill="var(--snow)" stroke="var(--line-strong)" strokeWidth="2" />
      <rect x="106" y="200" width="68" height="34" rx="6" fill="var(--night)" />
      <path d="M114 217 L166 217" stroke={led} strokeWidth="3" strokeLinecap="round" className={cn(scanning && "sim-scanline")} />
      <circle cx="140" cy="246" r="5" fill={led} className={cn(scanning && "sim-blink")} />

      {/* opening (dark slot) */}
      <path d="M62 112 L218 112 L228 122 L52 122 Z" fill="var(--night)" />

      {/* lid: hinged at the back edge, swings up */}
      <g className="sim-lid" style={{ transform: lidUp ? "rotate(-62deg)" : "rotate(0deg)" }}>
        <path d="M48 104 Q140 88 232 104 L232 116 L48 116 Z" fill="var(--violet)" stroke="var(--night)" strokeWidth="2" />
        <rect x="120" y="96" width="40" height="5" rx="2.5" fill="var(--orchid)" />
      </g>
    </svg>
  )
}
