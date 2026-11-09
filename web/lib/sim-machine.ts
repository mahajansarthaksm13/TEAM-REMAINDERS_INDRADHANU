// The Simulation Studio's bin, as a pure state machine (tests: tests/sim-machine.test.mjs).
// It never decides anything itself: OPEN_OK / OPEN_REFUSED / SERVER_RESULT carry the backend's
// answers (open_deposit_session, decide_deposit + ingest), so APPROVED can only follow a real
// approval. Illegal events are ignored, which keeps double clicks and late responses harmless.

export type SimState =
  | "LOCKED" | "QR_SCANNED" | "VALIDATING" | "OPENING" | "OPEN"
  | "DEPOSIT_IN_PROGRESS" | "CAMERA_VERIFYING" | "WEIGHT_CHECKING"
  | "APPROVED" | "REJECTED" | "REVIEW_REQUIRED" | "CLOSING" | "CLOSED" | "ERROR"

export type SimProduct = { id?: string; code?: string; name?: string; category?: string; unit_weight_g?: number }
export type Tally = { scans: number; opened: number; counted: number; review: number; blocked: number }

export type Sim = {
  state: SimState
  code: string | null
  sessionId: string | null
  product: SimProduct | null
  lidOpened: boolean
  reason: string | null
  receipt: Record<string, unknown> | null
  error: string | null
  tally: Tally
}

export type SimAction =
  | { type: "SCAN"; code: string }
  | { type: "VALIDATE" }
  | { type: "OPEN_OK"; sessionId: string; product: SimProduct }
  | { type: "OPEN_REFUSED"; reason: string }
  | { type: "LID_OPEN" }
  | { type: "DROP" }
  | { type: "CAMERA" }
  | { type: "WEIGH" }
  | { type: "SERVER_RESULT"; status: "approved" | "review" | "rejected"; reason?: string | null; receipt?: Record<string, unknown> | null }
  | { type: "CLOSE" }
  | { type: "CLOSED" }
  | { type: "FAIL"; message: string }
  | { type: "RESET" }
  | { type: "CLEAR_SCORE" }

const NO_SCORE: Tally = { scans: 0, opened: 0, counted: 0, review: 0, blocked: 0 }
const FRESH = { code: null, sessionId: null, product: null, lidOpened: false, reason: null, receipt: null, error: null }

export const initialSim = (): Sim => ({ state: "LOCKED", ...FRESH, tally: { ...NO_SCORE } })

const VERDICT: Record<string, SimState> = { approved: "APPROVED", review: "REVIEW_REQUIRED", rejected: "REJECTED" }
const bump = (t: Tally, k: keyof Tally): Tally => ({ ...t, [k]: t[k] + 1 })

export function sim(s: Sim, a: SimAction): Sim {
  switch (a.type) {
    case "SCAN":
      if (s.state !== "LOCKED" && s.state !== "CLOSED") return s
      return { ...s, ...FRESH, state: "QR_SCANNED", code: a.code, tally: bump(s.tally, "scans") }
    case "VALIDATE":
      return s.state === "QR_SCANNED" ? { ...s, state: "VALIDATING" } : s
    case "OPEN_OK":
      return s.state === "VALIDATING"
        ? { ...s, state: "OPENING", sessionId: a.sessionId, product: a.product, tally: bump(s.tally, "opened") }
        : s
    case "OPEN_REFUSED":
      return s.state === "VALIDATING" ? { ...s, state: "REJECTED", reason: a.reason, tally: bump(s.tally, "blocked") } : s
    case "LID_OPEN":
      return s.state === "OPENING" ? { ...s, state: "OPEN", lidOpened: true } : s
    case "DROP":
      return s.state === "OPEN" ? { ...s, state: "DEPOSIT_IN_PROGRESS" } : s
    case "CAMERA":
      return s.state === "DEPOSIT_IN_PROGRESS" ? { ...s, state: "CAMERA_VERIFYING" } : s
    case "WEIGH":
      return s.state === "CAMERA_VERIFYING" ? { ...s, state: "WEIGHT_CHECKING" } : s
    case "SERVER_RESULT": {
      if (s.state !== "WEIGHT_CHECKING") return s
      const key: keyof Tally = a.status === "approved" ? "counted" : a.status === "review" ? "review" : "blocked"
      return { ...s, state: VERDICT[a.status], reason: a.reason ?? null, receipt: a.receipt ?? null, tally: bump(s.tally, key) }
    }
    case "CLOSE":
      return s.lidOpened && (s.state === "APPROVED" || s.state === "REVIEW_REQUIRED" || s.state === "REJECTED")
        ? { ...s, state: "CLOSING" }
        : s
    case "CLOSED":
      return s.state === "CLOSING" ? { ...s, state: "CLOSED", lidOpened: false } : s
    case "FAIL":
      return { ...s, state: "ERROR", error: a.message, receipt: null }
    case "RESET":
      return { ...s, ...FRESH, state: "LOCKED" }
    case "CLEAR_SCORE":
      return { ...s, tally: { ...NO_SCORE } }
  }
}

// Same rule as ingest_scan: within max(3 g, 30% of the catalogue weight). Display only; the backend decides.
export const tolerance = (unitG: number) => Math.max(3, (unitG * 3) / 10)
export const withinTolerance = (weightG: number, unitG: number) => Math.abs(weightG - unitG) <= tolerance(unitG)

export type Scenario = {
  id: "A" | "B" | "C" | "D" | "E"
  title: string
  story: string
  code: "fresh" | "unknown" | "reuse"
  camera: boolean
  weight: "catalogue" | "zero" | "heavy"
  expect: string
}

export const SCENARIOS: Scenario[] = [
  { id: "A", title: "Genuine deposit", story: "A registered code, the item really goes in, the weight is right.", code: "fresh", camera: true, weight: "catalogue", expect: "Approved and counted" },
  { id: "B", title: "Fake QR code", story: "A code that VeriBin never issued.", code: "unknown", camera: false, weight: "zero", expect: "Lid stays shut" },
  { id: "C", title: "Scan, but no deposit", story: "The lid opens, but nothing goes in.", code: "fresh", camera: false, weight: "zero", expect: "Not counted" },
  { id: "D", title: "Reused code", story: "Someone scans a code that was already deposited.", code: "reuse", camera: true, weight: "catalogue", expect: "Lid stays shut" },
  { id: "E", title: "Wrong weight", story: "Something goes in, but it weighs 4 times too much.", code: "fresh", camera: true, weight: "heavy", expect: "Sent for review, not counted" },
]

export const scenarioWeight = (s: Scenario, unitG: number) => (s.weight === "zero" ? 0 : s.weight === "heavy" ? unitG * 4 : unitG)
