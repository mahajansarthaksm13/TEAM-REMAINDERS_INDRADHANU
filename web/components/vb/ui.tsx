// Server-safe building blocks (Frontend Spec §A4).
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "cn"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react"
import { CATEGORY_COLOR, CATEGORY_DESC, CATEGORY_LABEL, type Category } from "@/lib/shared"
import { kg, pct } from "@/lib/format"

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return <section id={id} className={cn("rounded-card border border-sage-200 bg-surface p-4 sm:p-6", className)}>{children}</section>
}

export function CardHead({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1 text-olive-700">{eyebrow}</p>}
        <h3 className="text-lg leading-[26px] font-semibold">{title}</h3>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow?: string; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[68ch]">
        {eyebrow && <p className="eyebrow mb-2 text-olive-700">{eyebrow}</p>}
        <h1 className="t-h2">{title}</h1>
        {desc && <p className="mt-2 text-sm text-olive-700">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

const badgeStyles = {
  qr: "bg-olive-700 text-garden-50",
  barcode: "bg-sage-200 text-olive-950",
  ok: "border border-success text-success",
  mismatch: "border border-warning text-warning",
  flagged: "border border-error text-error",
  pending: "bg-sage-200 text-olive-950",
  approved: "bg-success text-garden-50",
  readonly: "bg-olive-950 text-garden-50",
  warning: "border border-warning text-warning",
  error: "border border-error text-error",
  neutral: "border border-sage-600 text-olive-950",
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
export const FlagBadge = () => <Badge kind="flagged">✗ Flagged</Badge>

export function VerdictBanner({ kind, title, children }: { kind: "success" | "error" | "warning"; title: string; children?: ReactNode }) {
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? XCircle : AlertTriangle
  const tone = { success: "bg-success/10 text-success", error: "bg-error/10 text-error", warning: "bg-warning/10 text-warning" }[kind]
  return (
    <div role={kind === "success" ? "status" : "alert"} className={cn("flex gap-3 rounded-card p-5", tone)}>
      <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div>
        <p className="text-lg leading-[26px] font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-olive-950">{children}</div>}
      </div>
    </div>
  )
}

export function Notice({ kind = "warning", children }: { kind?: "warning" | "error" | "info"; children: ReactNode }) {
  const tone = kind === "warning" ? "border-warning/40 bg-warning/10 text-warning" : kind === "error" ? "border-error/40 bg-error/10 text-error" : "border-sage-200 bg-surface text-olive-700"
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("flex items-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-medium", tone)}>
      {kind !== "info" && <AlertTriangle className="size-4 shrink-0" aria-hidden />}
      {children}
    </p>
  )
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-sage-600/60 px-6 py-10 text-center text-sm text-olive-700">
      <p>{children}</p>
      {action}
    </div>
  )
}

export function KpiCard({ href, label, value, caption }: { href: string; label: string; value: string; caption?: ReactNode }) {
  return (
    <Link href={href} className="group rounded-card border border-sage-200 bg-surface p-4 transition-colors duration-150 hover:border-olive-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-6">
      <p className="eyebrow text-olive-700">{label}</p>
      <p className="t-kpi mt-2">{value}</p>
      {caption && <p className="mt-1 text-xs text-olive-700">{caption}</p>}
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

export function CategoryBar({ category, collected, target, href, atRisk, relative }: { category: Category; collected: number; target: number; href?: string; atRisk?: boolean; relative?: boolean }) {
  const p = pct(collected, target)
  const body = (
    <>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <CategorySwatch category={category} />
          {CATEGORY_LABEL[category]} <span className="font-normal text-olive-700">· {CATEGORY_DESC[category]}</span>
          {atRisk && <Badge kind="warning">⚠ At risk</Badge>}
        </span>
        <span className="tnum text-sm text-olive-700">
          {relative ? <span className="font-semibold text-olive-950">{kg(collected)}</span> : <>{kg(collected)} / {kg(target)} · <span className="font-semibold text-olive-950">{p}%</span></>}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sage-200" role="progressbar" aria-valuenow={Math.min(100, p)} aria-valuemin={0} aria-valuemax={100} aria-label={`${CATEGORY_LABEL[category]} progress`}>
        <div
          className={cn("h-full rounded-full", category === "cat4_compostable" && "hatch outline-1 outline-olive-700")}
          style={{ width: `${Math.min(100, p)}%`, backgroundColor: category === "cat4_compostable" ? undefined : CATEGORY_COLOR[category] }}
        />
      </div>
    </>
  )
  return href ? (
    <Link href={href} className="block rounded-[14px] p-2 -m-2 transition-colors hover:bg-garden-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
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
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-16 z-20 bg-surface">
            <tr className="border-b border-sage-200">
              {cols.map((c) => (
                <th key={c.key} scope="col" className={cn("eyebrow h-10 px-3 text-left whitespace-nowrap text-olive-700 first:pl-0 last:pr-0", c.align === "right" && "text-right")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className={cn("relative h-12 border-b border-sage-200 last:border-0", rowHref && "hover:bg-garden-50")}>
                {cols.map((c, i) => (
                  <td key={c.key} className={cn("px-3 py-2 first:pl-0 last:pr-0", c.align === "right" && "tnum text-right")}>
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
      <ul className="-my-2 divide-y divide-sage-200 md:hidden">
        {rows.map((r) => {
          const inner = (
            <>
              <div className="mb-2 flex items-center justify-between gap-2 font-semibold">
                <span className="min-w-0">{title(r)}</span>
                {rowHref && <ChevronRight className="size-4 shrink-0 text-olive-700" aria-hidden />}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {cols.filter((c) => !c.hideMobile).map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-olive-700">{c.label}</dt>
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
  const btn = "inline-flex h-10 items-center gap-1 rounded-full border border-sage-600 px-4 text-sm font-semibold hover:bg-sage-200"
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="tnum text-olive-700">
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
          <dt className="eyebrow pt-0.5 text-olive-700">{k}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export const ScoreText = ({ score }: { score: number | null }) =>
  score === null ? <span className="text-olive-700">Not enough data</span> : <span className={cn("tnum font-semibold", score < 60 && "text-warning")}>{score}{score < 60 && " ⚠"}</span>

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-error">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
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
