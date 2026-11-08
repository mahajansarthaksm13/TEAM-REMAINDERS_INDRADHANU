/* The ledger the app is written on. A few ruled lines at architectural scale draw themselves in
   once; hash blocks and chain links rest in the outer margins and breathe on long periods, always
   in linked pairs: a block and the link to the next one, which is the whole idea of the chain.
   Nothing above 8% opacity: felt, not read. Pure SVG + CSS keyframes, server-rendered. */

type Mark = { kind: "block" | "link"; x: number; y: number; r: number; rot: number; dy: number; dur: number; delay: number }

// Left and right thirds only; the centre stays clear for content.
const MARKS: Mark[] = [
  { kind: "block", x: 140, y: 130, r: 26, rot: -8, dy: -14, dur: 19, delay: 0 },
  { kind: "link", x: 252, y: 214, r: 18, rot: 30, dy: 10, dur: 23, delay: -6 },
  { kind: "link", x: 118, y: 438, r: 16, rot: -20, dy: -9, dur: 26, delay: -11 },
  { kind: "block", x: 226, y: 532, r: 22, rot: 7, dy: 12, dur: 21, delay: -3 },
  { kind: "block", x: 160, y: 708, r: 18, rot: -14, dy: -11, dur: 24, delay: -15 },
  { kind: "link", x: 300, y: 650, r: 14, rot: 45, dy: 8, dur: 28, delay: -8 },
  { kind: "link", x: 1052, y: 134, r: 20, rot: -30, dy: 13, dur: 22, delay: -4 },
  { kind: "block", x: 960, y: 228, r: 18, rot: 11, dy: -10, dur: 25, delay: -13 },
  { kind: "block", x: 1084, y: 426, r: 22, rot: -6, dy: 11, dur: 20, delay: -9 },
  { kind: "link", x: 972, y: 526, r: 15, rot: 20, dy: -8, dur: 27, delay: -2 },
  { kind: "link", x: 1046, y: 694, r: 18, rot: -45, dy: 9, dur: 23, delay: -17 },
  { kind: "block", x: 930, y: 640, r: 15, rot: 13, dy: -12, dur: 26, delay: -7 },
]

export function Backdrop() {
  return (
    <div className="vb-backdrop" aria-hidden="true">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <g className="vb-rule" stroke="var(--line)" strokeWidth={1.5} strokeLinecap="round" fill="none">
          <line x1={400} y1={64} x2={400} y2={736} style={{ animationDelay: "0.1s" }} />
          <line x1={800} y1={64} x2={800} y2={736} style={{ animationDelay: "0.25s" }} />
          <line x1={64} y1={267} x2={1136} y2={267} style={{ animationDelay: "0.4s" }} />
          <line x1={64} y1={533} x2={1136} y2={533} style={{ animationDelay: "0.55s" }} />
        </g>
        {MARKS.map((m, i) => (
          <g key={i} transform={`translate(${m.x} ${m.y}) rotate(${m.rot})`}>
            <g className="vb-float" style={{ "--dy": `${m.dy}px`, "--dur": `${m.dur}s`, animationDelay: `${m.delay}s` } as React.CSSProperties}>
              {m.kind === "block" ? (
                // a hash block: rounded square with a ruled line, like a record in the ledger
                <g className="vb-mark" strokeWidth={m.r * 0.16} strokeLinecap="round" fill="none">
                  <rect x={-m.r} y={-m.r} width={m.r * 2} height={m.r * 2} rx={m.r * 0.35} />
                  <line x1={-m.r * 0.5} y1={0} x2={m.r * 0.5} y2={0} />
                </g>
              ) : (
                // a chain link: two interlocked rings
                <g className="vb-mark vb-mark--warm" strokeWidth={m.r * 0.22} fill="none">
                  <ellipse cx={-m.r * 0.45} cy={0} rx={m.r * 0.7} ry={m.r * 0.42} />
                  <ellipse cx={m.r * 0.45} cy={0} rx={m.r * 0.7} ry={m.r * 0.42} />
                </g>
              )}
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}
