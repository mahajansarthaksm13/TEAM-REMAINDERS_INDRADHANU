// Types + constants safe for client and server. Names follow docs/CONTRACTS.md and the migrations.

export type Category = "cat1_rigid" | "cat2_flexible" | "cat3_multilayer" | "cat4_compostable"
export type Role = "company" | "auditor" | "regulator" | "admin"
export type Tier = "qr" | "barcode"

export const CATEGORIES: Category[] = ["cat1_rigid", "cat2_flexible", "cat3_multilayer", "cat4_compostable"]

export const CATEGORY_LABEL: Record<Category, string> = {
  cat1_rigid: "Category I",
  cat2_flexible: "Category II",
  cat3_multilayer: "Category III",
  cat4_compostable: "Category IV",
}

export const CATEGORY_DESC: Record<Category, string> = {
  cat1_rigid: "Rigid plastics",
  cat2_flexible: "Flexible plastics",
  cat3_multilayer: "Multi-layered plastics",
  cat4_compostable: "Compostable plastics",
}

// Design Brief §5: I = Olive Black, II = Deep Olive, III = Muted Sage, IV = Sage Mist + hatch
export const CATEGORY_COLOR: Record<Category, string> = {
  cat1_rigid: "#1F261A",
  cat2_flexible: "#4A543D",
  cat3_multilayer: "#8B9678",
  cat4_compostable: "#D7DEC8",
}

export const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category)

// bins.city stores the 3-letter code from the bin id (VB-<CITY3>-NNNN)
const CITY: Record<string, string> = { PUN: "Pune", MUM: "Mumbai", NAG: "Nagpur" }
export const cityName = (code: string | null | undefined) => (code ? (CITY[code] ?? code) : "—")

export const ROLE_LABEL: Record<Role, string> = {
  company: "Company",
  auditor: "Auditor",
  regulator: "Regulator",
  admin: "Admin",
}

export const READ_ONLY_ROLES: Role[] = ["auditor", "regulator"]

// One row in the live feed / scan list (scans joined to products + bins).
export type FeedRow = {
  scan_id: string
  bin_id: string
  city: string
  product_name: string
  category: Category
  weight_g: number
  tier: Tier
  weight_ok: boolean | null
  flagged: boolean
  scanned_at: string
  received_at: string
}

// Trust-score reason written by the AI job: {code, points, detail}
export type ScoreReason = { code: string; points: number; detail: string }

export const CHECKPOINTS_REPO = process.env.NEXT_PUBLIC_CHECKPOINTS_REPO || "mahajansarthaksm13/veribin-checkpoints"
export const checkpointUrl = (day: string) =>
  `https://github.com/${CHECKPOINTS_REPO}/blob/main/checkpoints/${day}.json`

// Optional: a real report id to show as "Verify a sample report" on the public site.
export const SAMPLE_REPORT_ID = process.env.NEXT_PUBLIC_SAMPLE_REPORT_ID || ""

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const STEPS = [
  { n: 1, title: "Scan", body: "A packet is dropped in a VeriBin. The bin reads its QR or barcode and weighs it." },
  { n: 2, title: "Sign", body: "The bin signs the record with its own Ed25519 key. Change one character and the signature fails." },
  { n: 3, title: "Chain", body: "Each record carries the hash of the one before it. Every night the chain heads are sealed in a public checkpoint." },
  { n: 4, title: "Report", body: "Companies file a Collection Evidence Report. Its QR code lets anyone rebuild it from the ledger." },
]

// Cheap "is someone logged in" for public pages (header CTA). Not an auth check:
// the dashboard validates the session with Supabase on every request.
export const hasSessionCookie = (c: { getAll(): { name: string }[] }) => c.getAll().some((x) => x.name.startsWith("sb-") && x.name.includes("-auth-token"))

// AI sentences carry raw codes (cat1_rigid, PUN); show them as labels.
export const humanize = (text: string) =>
  text.replace(/cat[1-4]_[a-z]+/g, (m) => (isCategory(m) ? CATEGORY_LABEL[m] : m)).replace(/(PUN|MUM|NAG)/g, (m) => cityName(m))
