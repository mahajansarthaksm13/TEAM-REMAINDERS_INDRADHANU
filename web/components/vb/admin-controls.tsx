"use client"

// Controls for the admin's Manage page. Each one calls an admin-only server action, shows the
// result as a toast, and refreshes the page. Destructive actions ask for a second click in place
// (no pop-up), and a blocked action stays visible but disabled with its reason.
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { createCompany, renameCompany, setAuditorAssignment, setUserAccess, type AdminResult } from "@/lib/admin-actions"
import { ROLE_LABEL, type Role } from "@/lib/shared"

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<AdminResult>, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) {
        toast.success(r.message)
        after?.()
        router.refresh()
      } else toast.error(r.error)
    })
  return { run, pending }
}

// One action. `action` is a server action already bound to its record (e.g. deleteCompany.bind(null, id)).
export function AdminButton({
  action,
  label,
  confirmLabel,
  tone = "default",
  blocked,
}: {
  action: () => Promise<AdminResult>
  label: string
  confirmLabel?: string // set for destructive actions: first click arms, second click runs
  tone?: "default" | "danger"
  blocked?: string | null // reason the action is not allowed; the button shows, disabled
}) {
  const { run, pending } = useRun()
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 6000) // disarm if the admin walks away
    return () => clearTimeout(t)
  }, [armed])

  if (blocked) {
    return (
      <span className="inline-flex flex-col items-start">
        <Button size="sm" variant="ghost" disabled title={blocked} aria-label={`${label}: not available. ${blocked}`}>
          {label}
        </Button>
      </span>
    )
  }
  if (armed) {
    return (
      <span className="inline-flex items-center gap-1" role="group" aria-label={`Confirm ${label.toLowerCase()}`}>
        <Button size="sm" variant={tone === "danger" ? "destructive" : "default"} disabled={pending} onClick={() => run(action, () => setArmed(false))}>
          {pending && <Loader2 className="animate-spin" />}
          {confirmLabel}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setArmed(false)} disabled={pending} aria-label="Cancel" title="Cancel"><X /></Button>
      </span>
    )
  }
  return (
    <Button
      size="sm"
      variant={tone === "danger" ? "destructive" : "secondary"}
      disabled={pending}
      onClick={() => (confirmLabel ? setArmed(true) : run(action))}
    >
      {pending && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  )
}

export function CreateCompanyForm() {
  const { run, pending } = useRun()
  const [name, setName] = useState("")
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => createCompany(name), () => setName(""))
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold sm:max-w-sm">
        New company
        <input id="new-company" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shakti Foods Pvt Ltd" maxLength={120} className="neu-inset h-10 rounded-input px-3 text-sm font-normal text-ink focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none" />
      </label>
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {pending && <Loader2 className="animate-spin" />}Add company
      </Button>
    </form>
  )
}

export function RenameCompany({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const { run, pending } = useRun()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  if (!editing)
    return (
      <span className="inline-flex items-center gap-2">
        <span className={cn("font-semibold", archived && "text-dim line-through decoration-orchid/60")}>{name}</span>
        <button type="button" onClick={() => (setValue(name), setEditing(true))} className="inline-flex size-7 items-center justify-center rounded-full text-dim hover:bg-panel-hi hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Rename ${name}`}>
          <Pencil className="size-3.5" />
        </button>
      </span>
    )
  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => renameCompany(id, value), () => setEditing(false))
      }}
    >
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label="Company name" maxLength={120} className="neu-inset h-8 w-44 rounded-input px-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none" />
      <button type="submit" disabled={pending} aria-label="Save name" className="inline-flex size-8 items-center justify-center rounded-full text-lit hover:bg-panel-hi">{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}</button>
      <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="inline-flex size-8 items-center justify-center rounded-full text-dim hover:bg-panel-hi"><X className="size-4" /></button>
    </form>
  )
}

const ROLES = Object.keys(ROLE_LABEL) as Role[]

export function UserAccess({ userId, role, companyId, companies, isSelf }: { userId: string; role: Role; companyId: string | null; companies: { id: string; name: string }[]; isSelf: boolean }) {
  const { run, pending } = useRun()
  const [r, setR] = useState<Role>(role)
  const [c, setC] = useState(companyId ?? companies[0]?.id ?? "")
  const dirty = r !== role || (r === "company" && c !== companyId)
  if (isSelf) return <span className="text-sm">{ROLE_LABEL[role]} <span className="text-dim">(you)</span></span>
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => setUserAccess(userId, r, r === "company" ? c : null))
      }}
    >
      <select aria-label="Role" value={r} onChange={(e) => setR(e.target.value as Role)} className="neu-inset h-9 rounded-input px-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none">
        {ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
      </select>
      {r === "company" && (
        <select aria-label="Company" value={c} onChange={(e) => setC(e.target.value)} className="neu-inset h-9 max-w-48 rounded-input px-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none">
          {companies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      {dirty && (
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}Save
        </Button>
      )}
    </form>
  )
}

export function AuditorAssignments({ auditorId, assigned, companies }: { auditorId: string; assigned: string[]; companies: { id: string; name: string }[] }) {
  const { run, pending } = useRun()
  return (
    <div role="group" aria-label="Companies this auditor oversees" className="flex flex-wrap gap-1.5">
      {companies.map((c) => {
        const on = assigned.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            disabled={pending}
            onClick={() => run(() => setAuditorAssignment(auditorId, c.id, !on))}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              on ? "neu-pill text-ink" : "neu-press text-dim opacity-70 hover:opacity-100"
            )}
          >
            {on && <Check className="size-3.5 text-lit" aria-hidden />}
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
