"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Activity, Bell, Box, ChevronDown, FileCheck2, LogOut, Menu, Package, Route, Settings, Sparkles, Target } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { closeAlert, logout } from "@/lib/actions"
import { parsePeriod, periodOptions } from "@/lib/period"
import { timeAgo } from "@/lib/format"
import { ALERT_LABEL, ROLE_LABEL, humanize, type Role } from "@/lib/shared"
import { Wordmark } from "./brand"
import { Badge } from "./ui"

const NAV = [
  { href: "/app/live", label: "Live Data", icon: Activity },
  { href: "/app/flow", label: "Where waste goes", icon: Route },
  { href: "/app/insights", label: "AI Insights", icon: Sparkles },
  { href: "/app/reports", label: "Reports", icon: FileCheck2 },
  { href: "/app/bins", label: "Bins", icon: Box },
  { href: "/app/targets", label: "Targets", icon: Target },
  { href: "/app/catalogue", label: "Catalogue", icon: Package, hideFor: ["auditor", "regulator"] as Role[] },
  { href: "/app/settings", label: "Settings", icon: Settings },
]

// Carry company scope + period across navigation.
function useKeep() {
  const sp = useSearchParams()
  return (path: string) => {
    const [base, extra] = path.split("?")
    const q = new URLSearchParams(extra)
    for (const k of ["company", "period"]) {
      const v = sp.get(k)
      if (v) q.set(k, v)
    }
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }
}

function NavList({ role }: { role: Role }) {
  const path = usePathname()
  const keep = useKeep()
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {NAV.filter((n) => !n.hideFor?.includes(role)).map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href)
        return (
          <Link
            key={href}
            href={keep(href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-dim transition-[background-color,color,transform] duration-300 ease-(--ease-spring) hover:translate-x-1 hover:bg-panel-hi/60 hover:text-ink",
              active && "neu-press text-ink [&_svg]:text-lit"
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-8 border-r neu-bar px-4 py-6 lg:flex">
      <Wordmark href="/app/live" className="px-4" />
      <NavList role={role} />
      <p className="eyebrow mt-auto px-4 text-dim">All times IST</p>
    </aside>
  )
}

export type AlertItem = { id: string; type: string; message: string; created_at: string; href: string; canClose: boolean }
export type Scope = { options: { id: string; name: string }[]; staticName?: string }

export function TopBar({ user, scope, alerts }: { user: { name: string; email: string; role: Role }; scope: Scope; alerts: AlertItem[] }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const keep = useKeep()
  const period = parsePeriod(sp.get("period"))
  const opts = periodOptions(period.fy)
  const prevFy = periodOptions(period.fy - 1).year[0]
  const nextFy = parsePeriod(null).fy > period.fy ? periodOptions(period.fy + 1).year[0] : null

  function set(k: string, v: string) {
    const q = new URLSearchParams(sp.toString())
    q.set(k, v)
    q.delete("page")
    router.push(`${path}?${q}`)
  }

  const readOnly = user.role === "auditor" || user.role === "regulator"

  return (
    <header className="no-print sticky top-0 z-30 border-b neu-bar">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(86vw,320px)] neu-bar px-4 py-5 text-ink">
            <SheetTitle className="px-4 font-display text-[28px] font-normal text-ink">VeriBin</SheetTitle>
            <SheetClose asChild>
              <div><NavList role={user.role} /></div>
            </SheetClose>
          </SheetContent>
        </Sheet>

        {scope.staticName ? (
          <p className="min-w-0 truncate text-sm font-semibold">{scope.staticName}</p>
        ) : (
          <Select value={scope.options.find((o) => o.id === sp.get("company"))?.id ?? scope.options[0]?.id} onValueChange={(v) => set("company", v)}>
            <SelectTrigger aria-label="Company scope" className="h-10 max-w-[44vw] min-w-0 sm:max-w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {scope.options.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={period.key} onValueChange={(v) => set("period", v)}>
          <SelectTrigger aria-label="Period (financial year, IST)" className="h-10 shrink-0">
            <SelectValue>{period.label}</SelectValue>
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-80">
            <SelectGroup>
              <SelectLabel>Year · April–March, IST</SelectLabel>
              {nextFy && <SelectItem value={nextFy.key}>{nextFy.label}</SelectItem>}
              <SelectItem value={opts.year[0].key}>{opts.year[0].label}</SelectItem>
              <SelectItem value={prevFy.key}>{prevFy.label}</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Quarter</SelectLabel>
              {opts.quarter.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Month</SelectLabel>
              {opts.month.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>

        {readOnly && <Badge kind="readonly" className="hidden sm:inline-flex">Read-only</Badge>}

        <div className="ml-auto flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Notifications, ${alerts.length} open`} className="relative">
                <Bell />
                {alerts.length > 0 && (
                  <span className="tnum absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet px-1 text-[10px] font-semibold text-snow">{alerts.length}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
              <p className="eyebrow border-b border-line px-4 py-3 text-dim">Open alerts</p>
              {alerts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-dim">No open alerts.</p>
              ) : (
                <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-start gap-1 pr-2 hover:bg-panel-hi">
                      <Link href={keep(a.href)} className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-sm">
                        <span className={cn("eyebrow", a.type === "chain_break" ? "text-ink" : a.type === "bin_offline" ? "text-dim" : "text-ink")}>
                          {a.type === "chain_break" ? "✗ " : a.type === "bin_offline" ? "" : "⚠ "}
                          {ALERT_LABEL[a.type] ?? a.type}
                        </span>
                        <span className="font-semibold">{humanize(a.message)}</span>
                        <span className="text-xs text-dim">{timeAgo(a.created_at)}</span>
                      </Link>
                      {a.canClose && (
                        <Button variant="ghost" size="sm" className="mt-2 shrink-0" onClick={() => closeAlert(a.id).then(() => router.refresh())} aria-label={`Close alert: ${a.message}`}>
                          Close
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2 sm:px-3" aria-label="Profile menu">
                <span className="flex size-8 items-center justify-center rounded-full bg-lit text-xs font-bold text-on-lit">
                  {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </span>
                <ChevronDown className="hidden size-4 sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs text-dim">{ROLE_LABEL[user.role]} · {user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={keep("/app/settings")}><Settings />Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => logout()}>
                <LogOut />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {readOnly && <p className="border-t border-line px-4 py-1 text-xs font-semibold sm:hidden">Read-only access</p>}
    </header>
  )
}
