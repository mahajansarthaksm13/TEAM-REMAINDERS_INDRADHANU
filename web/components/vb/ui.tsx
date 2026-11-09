// Server-safe building blocks (Frontend Spec §A4).
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "cn"
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, XCircle } from "lucide-react"
import { CountUp } from "./count-up"
import { ANOMALY_THRESHOLD, CATEGORY_COLOR, CATEGORY_DESC, CATEGORY_LABEL, reasonLabel, type Category, type ScoreReason } from "@/lib/shared"
import { kg, pct } from "@/lib/format"

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return <section id={id} className={cn("neu rounded-card p-4 sm:p-6", className)}>{children}</section>
}

export function CardHead({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1 text-dim">{eyebrow}</p>}
        <h3 className="text-lg leading-[26px] font-semibold">{title}</h3>
      </div>
      {action}
    </div>
  )
}

// back: where this page sits under, shown as a "← Bins" link above the title so a detail page
// always says how to get out of it.
export function PageHeader({ eyebrow, title, desc, actions, back }: { eyebrow?: string; title: string; desc?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[68ch]">
        {back && (
          <Link href={back.href} className="neu-pill mb-4 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-dim transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <ArrowLeft className="size-3.5" aria-hidden />
            {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow mb-2 text-dim">{eyebrow}</p>}
        <h1 className="t-h2">{title}</h1>
        {desc && <p className="mt-2 text-sm text-dim">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

const badgeStyles = {
  qr: "bg-violet text-snow",
  barcode: "bg-chip text-ink ring-1 ring-line-strong",
  ok: "border border-success text-success",
  mismatch: "border border-warning text-ink",
  flagged: "border border-error bg-error font-bold text-on-lit",
  pending: "bg-chip text-ink",
  approved: "bg-success/15 text-success ring-1 ring-success/50",
  readonly: "bg-violet text-snow",
  warning: "border border-warning text-ink",
  error: "border border-error bg-error font-bold text-on-lit",
  neutral: "border border-line-strong text-ink",
} as const

export function Badge({ kind = "neutral", children, className }: { kind?: keyof typeof badgeStyles; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1 rounded-badge px-2 text-[13px] leading-none font-semibold whitespace-nowrap", badgeStyles[kind], className)}>
      {children}
    </span>
  )
}

export const TierBadge = ({ tier }: { tier: "qr" | "barcode" }) => <Badge kind={tier}>{tier === "qr" ? "QR" : "Barcode"}</Badge>
// weight_ok null = the bin has no load cell (weight_g = 0)
export const WeightBadge = ({ ok }: { ok: boolean | null }) =>
  ok === null ? <Badge kind="neutral">No sensor</Badge> : ok ? <Badge kind="ok">✓ Weight OK</Badge> : <Badge kind="mismatch">⚠ Weight mismatch</Badge>

export function VerdictBanner({ kind, title, children }: { kind: "success" | "error" | "warning"; title: string; children?: ReactNode }) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? XCircle : AlertTriangle
  const tone = { success: "bg-success/10 text-success", error: "bg-error/10 text-ink", warning: "bg-warning/10 text-ink" }[kind]
  return (
    <div role={kind === "success" ? "status" : "alert"} className={cn("flex gap-3 rounded-card p-5", tone)}>
      <Icon className={cn("mt-0.5 size-6 shrink-0", kind !== "success" && "text-lit")} aria-hidden />
      <div>
        <p className="text-lg leading-[26px] font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-ink">{children}</div>}
      </div>
    </div>
  )
}

export function Notice({ kind = "warning", children }: { kind?: "warning" | "error" | "info"; children: ReactNode }) {
  const tone = kind === "warning" ? "border-warning/40 bg-warning/10 text-ink" : kind === "error" ? "border-error/40 bg-error/10 text-ink" : "border-line bg-panel text-dim"
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("flex items-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-medium", tone)}>
      {kind !== "info" && <AlertTriangle className="size-4 shrink-0 text-lit" aria-hidden />}
      {children}
    </p>
  )
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-line-strong/60 px-6 py-10 text-center text-sm text-dim">
      <p>{children}</p>
      {action}
    </div>
  )
}

export function KpiCard({ href, label, value, caption }: { href: string; label: string; value: string; caption?: ReactNode }) {
  return (
    <Link href={href} className="group neu rounded-card p-4 transition-transform duration-500 ease-(--ease-spring) hover:-translate-y-1 focus-visible:outline-none sm:p-6">
      <p className="eyebrow text-dim">{label}</p>
      <p className="t-kpi mt-3 whitespace-nowrap text-ink transition-colors group-hover:text-lit"><CountUp value={value} /></p>
      {caption && <p className="mt-1 text-xs text-dim">{caption}</p>}
    </Link>
  )
}

export function CategorySwatch({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-[3px]", category === "cat4_compostable" && "hatch", className)}
      style={category === "cat4_compostable" ? undefined : { backgroundColor: CATEGORY_COLOR[category] }}
    />
  )
}

// One EPR category: name + headline number on top, bar, then the kg detail (summary -> evidence).
// collected/target are kg (backend units). relative = public page, bars scaled to the largest category.
export function CategoryBar({ category, collected, target, href, atRisk, relative }: { category: Category; collected: number; target: number; href?: string; atRisk?: boolean; relative?: boolean }) {
  const p = pct(collected, target)
  const noTarget = !relative && target <= 0
  const body = (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-2">
          <CategorySwatch category={category} className="mt-1" />
          <span className="min-w-0">
            <span className="block text-sm leading-5 font-semibold">{CATEGORY_LABEL[category]}</span>
            <span className="block text-xs leading-4 text-dim">{CATEGORY_DESC[category]}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {atRisk && <Badge kind="warning">⚠ At risk</Badge>}
          <span className="tnum text-xl leading-6 font-semibold">{relative ? kg(collected) : noTarget ? "—" : `${p}%`}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-chip" role="progressbar" aria-valuenow={Math.min(100, p)} aria-valuemin={0} aria-valuemax={100} aria-label={`${CATEGORY_LABEL[category]} progress`}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-(--ease-out)", category === "cat4_compostable" && "hatch")}
          style={{ width: `${Math.min(100, p)}%`, backgroundColor: category === "cat4_compostable" ? undefined : CATEGORY_COLOR[category] }}
        />
      </div>
      {!relative && (
        <p className="tnum mt-1.5 flex justify-between gap-3 text-xs text-dim">
          <span>{kg(collected)} collected</span>
          <span>{noTarget ? "No target set" : `of ${kg(target)} target`}</span>
        </p>
      )}
    </>
  )
  return href ? (
    <Link href={href} className="-m-2 block rounded-[14px] p-2 transition-colors hover:bg-panel-hi focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  )
}

export type Col<T> = { key: string; label: string; cell: (r: T) => ReactNode; align?: "right"; hideMobile?: boolean }

// Table on md+, stacked cards below md (Design Brief §7).
export function DataTable<T>({ rows, cols, rowKey, rowHref, title, caption }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; rowHref?: (r: T) => string; title: (r: T) => ReactNode; caption?: string }) {
  return (
    <>
      {/* No sticky header here: inside overflow-x-auto it sticks relative to this box and covers row 1. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line-strong/50">
              {cols.map((c) => (
                <th key={c.key} scope="col" className={cn("eyebrow h-10 px-3 pb-2 text-left align-bottom whitespace-nowrap text-dim first:pl-0 last:pr-0", c.align === "right" && "text-right")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={cn("relative h-14 border-b border-line last:border-0", rowHref && "cursor-pointer transition-colors duration-200 hover:bg-panel-hi/70")}>
                {cols.map((c, i) => (
                  <td key={c.key} className={cn("px-3 py-3 align-middle first:pl-0 first:font-semibold last:pr-0", c.align === "right" && "tnum text-right")}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(r)} className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none">
                        {c.cell(r)}
                      </Link>
                    ) : (
                      c.cell(r)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="-my-2 divide-y divide-line md:hidden">
        {rows.map((r) => {
          const inner = (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 font-semibold">
                <span className="min-w-0">{title(r)}</span>
                {rowHref && <ChevronRight className="size-4 shrink-0 text-dim" aria-hidden />}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {cols.filter((c) => !c.hideMobile).map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-dim">{c.label}</dt>
                    <dd className="tnum min-w-0 text-right">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )
          return (
            <li key={rowKey(r)}>
              {rowHref ? <Link href={rowHref(r)} className="block py-4">{inner}</Link> : <div className="py-4">{inner}</div>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function Pagination({ page, total, per, hrefFor }: { page: number; total: number; per: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / per))
  const btn = "btn-neu flow-btn inline-flex h-10 items-center gap-1 rounded-xl px-4 text-sm font-semibold text-ink"
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="tnum text-dim">
        Page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? <Link className={btn} href={hrefFor(page - 1)}><ChevronLeft className="size-4" />Prev</Link> : <span className={cn(btn, "pointer-events-none opacity-40")}><ChevronLeft className="size-4" />Prev</span>}
        {page < pages ? <Link className={btn} href={hrefFor(page + 1)}>Next<ChevronRight className="size-4" /></Link> : <span className={cn(btn, "pointer-events-none opacity-40")}>Next<ChevronRight className="size-4" /></span>}
      </span>
    </nav>
  )
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(140px,auto)_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="eyebrow pt-0.5 text-dim">{k}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// Trust score 0-100 from the nightly AI job. Bands: below ANOMALY_THRESHOLD the job opens an anomaly alert.
export function ScoreText({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-dim">Not enough data</span>
  const band = score < ANOMALY_THRESHOLD ? { label: "Anomaly", kind: "warning" as const } : score < 80 ? { label: "Watch", kind: "neutral" as const } : { label: "Good", kind: "ok" as const }
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn("tnum text-base font-semibold", band.kind === "warning" && "text-ink")}>{score}</span>
      <Badge kind={band.kind}>{band.kind === "warning" && "⚠ "}{band.label}</Badge>
    </span>
  )
}

// Score deductions {code, points, detail}: short label with points, full detail on hover.
export function ReasonList({ reasons, max = 2 }: { reasons: ScoreReason[]; max?: number }) {
  const shown = reasons.filter((r) => r.code !== "NOT_ENOUGH_DATA").slice(0, max)
  if (!shown.length) return <span className="text-dim">—</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((r) => (
        <span key={r.code} title={r.detail} className="inline-flex items-center gap-1 rounded-badge bg-chip px-2 py-0.5 text-xs whitespace-nowrap ring-1 ring-line">
          {reasonLabel(r.code)}
          <span className="tnum font-semibold text-dim">−{Math.round(r.points)}</span>
        </span>
      ))}
      {reasons.length > shown.length + (reasons.some((r) => r.code === "NOT_ENOUGH_DATA") ? 1 : 0) && <span className="text-xs text-dim">+{reasons.length - shown.length} more</span>}
    </span>
  )
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-ink">
      <AlertTriangle className="size-4 shrink-0 text-lit" aria-hidden />
      {children}
    </p>
  )
}

export function StatusBadge({ status, quiet }: { status: string; quiet: boolean }) {
  if (status === "revoked") return <Badge kind="neutral">Revoked</Badge>
  if (status === "inactive") return <Badge kind="neutral">Inactive</Badge>
  if (quiet) return <Badge kind="warning">⚠ Quiet</Badge>
  return <Badge kind="ok">● Active</Badge>
}

// Change badge, e.g. "+12.4%" vs the previous window. Up is good here (more plastic collected);
// the arrow and sign carry the direction, never colour alone.
export function DeltaChip({ value, label = "vs previous", tone = "light" }: { value: number | null; label?: string; tone?: "light" | "onViolet" }) {
  if (value === null) return <span className="text-xs text-dim">No earlier data</span>
  const up = value >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      title={`${up ? "+" : "−"}${Math.abs(value).toFixed(1)}% ${label}`}
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone === "onViolet" ? "bg-snow/20 text-snow" : up ? "bg-chip text-lit" : "border border-warning text-ink"
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : "−"}{Math.abs(value).toFixed(1)}%
      <span className="sr-only"> {label}</span>
    </span>
  )
}
