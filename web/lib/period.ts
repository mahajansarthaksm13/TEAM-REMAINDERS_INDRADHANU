// Indian financial year (April–March). Period param: "FY2026" | "FY2026-Q2" | "2026-10".
import { istDay } from "./format"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function currentFY(now = Date.now()) {
  const [y, m] = istDay(now).split("-").map(Number)
  return m >= 4 ? y : y - 1
}

export const fyLabel = (fy: number) => `FY ${fy}–${String(fy + 1).slice(2)}`
// targets.financial_year / forecasts.financial_year format: "2026-27"
export const fyKey = (fy: number) => `${fy}-${String((fy + 1) % 100).padStart(2, "0")}`
export const fyStart = (fy: number) => `${fy}-04-01`

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const pad = (n: number) => String(n).padStart(2, "0")

export type Period = { key: string; from: string; to: string; label: string; mode: "year" | "quarter" | "month"; fy: number }

export function parsePeriod(raw: string | undefined | null, now = Date.now()): Period {
  const fyNow = currentFY(now)
  let m = raw?.match(/^FY(\d{4})-Q([1-4])$/)
  if (m) {
    const fy = +m[1], q = +m[2]
    const sm = 4 + (q - 1) * 3 // Q1 = Apr
    const y = sm > 12 ? fy + 1 : fy
    const smm = ((sm - 1) % 12) + 1
    const em = smm + 2
    return { key: raw!, mode: "quarter", fy, from: `${y}-${pad(smm)}-01`, to: `${y}-${pad(em)}-${lastDay(y, em)}`, label: `Q${q} ${fyLabel(fy)}` }
  }
  m = raw?.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const y = +m[1], mo = +m[2]
    if (mo >= 1 && mo <= 12)
      return { key: raw!, mode: "month", fy: mo >= 4 ? y : y - 1, from: `${y}-${pad(mo)}-01`, to: `${y}-${pad(mo)}-${lastDay(y, mo)}`, label: `${MONTHS[mo - 1]} ${y}` }
  }
  m = raw?.match(/^FY(\d{4})$/)
  const fy = m ? +m[1] : fyNow
  return { key: `FY${fy}`, mode: "year", fy, from: `${fy}-04-01`, to: `${fy + 1}-03-31`, label: fyLabel(fy) }
}

export function periodOptions(fy: number) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const mo = ((i + 3) % 12) + 1
    const y = mo >= 4 ? fy : fy + 1
    return { key: `${y}-${pad(mo)}`, label: `${MONTHS[mo - 1]} ${y}` }
  })
  return {
    year: [{ key: `FY${fy}`, label: fyLabel(fy) }],
    quarter: [1, 2, 3, 4].map((q) => ({ key: `FY${fy}-Q${q}`, label: `Q${q} (${MONTHS[(q * 3) % 12]}–${MONTHS[(q * 3 + 2) % 12]})` })),
    month: months,
  }
}

// FY months as "YYYY-MM" (Apr→Mar)
export const fyMonths = (fy: number) => periodOptions(fy).month.map((m) => m.key)
