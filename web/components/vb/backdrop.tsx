/* The glow the neu floats over: three soft palette lights drifting on long periods, a faint dot
   grid fading out downward. Fixed behind everything; pure CSS, server-rendered. */

const GLOWS = [
  // [left, top, size, colour, opacity, drift x, drift y, period]
  ["-12vw", "-18vh", "62vw", "var(--violet)", 0.42, "8vw", "6vh", "26s"],
  ["58vw", "-10vh", "48vw", "var(--orchid)", 0.22, "-6vw", "8vh", "31s"],
  ["30vw", "62vh", "54vw", "var(--violet)", 0.3, "-8vw", "-6vh", "35s"],
] as const

export function Backdrop() {
  return (
    <div className="vb-backdrop" aria-hidden="true">
      {GLOWS.map(([left, top, size, color, opacity, dx, dy, dur], i) => (
        <span
          key={i}
          className="vb-glow"
          style={{ left, top, width: size, height: size, background: color, opacity, "--dx": dx, "--dy": dy, "--dur": dur } as React.CSSProperties}
        />
      ))}
      <div className="vb-grid" />
    </div>
  )
}
