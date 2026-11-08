// Display helpers. One time model: IST everywhere (Design Brief §8.6).

const IST_OFFSET_MS = 5.5 * 3600_000

export const istDay = (iso: string | number | Date) =>
  new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

const dtFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" })

export const fmtDateTime = (iso: string) => `${dtFmt.format(new Date(iso))} IST`
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso))
export const fmtDay = (day: string) => dayFmt.format(new Date(day + "T00:00:00Z"))

// Backend read functions return kg (numeric, 3 decimals).
export const kg = (v: number) => `${v.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
export const num = (n: number) => n.toLocaleString("en-IN")
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

export const truncHash = (h: string) => (h.length > 12 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h)

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}
