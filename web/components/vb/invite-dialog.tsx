"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ROLE_LABEL, type Role } from "@/lib/shared"
import { FieldError, Notice } from "./ui"

const select = "h-10 w-full glass-inset rounded-input text-ink px-3 text-sm focus-visible:ring-2 focus-visible:ring-lit focus-visible:outline-none"

export function InviteDialog({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("company")
  const [company, setCompany] = useState(companies[0]?.id ?? "")
  const [errs, setErrs] = useState<{ email?: string; form?: string }>({})
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErrs({ email: "Enter a valid email address." })
    setPending(true)
    setErrs({})
    try {
      const r = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role, company_id: role === "company" || role === "auditor" ? company : undefined }) })
      if (r.status === 409) return setErrs({ email: "This email already has an account." })
      if (r.status === 422) return setErrs({ email: "Enter a valid email address." })
      if (!r.ok) return setErrs({ form: "Invite couldn't be sent. Try again." })
      toast.success(`Invite sent to ${email}.`)
      setOpen(false)
      setEmail("")
      router.refresh()
    } catch {
      setErrs({ form: "Couldn't reach the server. Try again." })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button><UserPlus />Invite user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>They&apos;ll get an email to set a password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {errs.form && <Notice kind="error">{errs.form}</Notice>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email || undefined} aria-describedby={errs.email ? "inv-email-err" : undefined} />
            {errs.email && <FieldError id="inv-email-err">{errs.email}</FieldError>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-role">Role</Label>
            <select id="inv-role" className={select} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          {(role === "company" || role === "auditor") && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-co">{role === "auditor" ? "Assigned company" : "Company"}</Label>
              <select id="inv-co" className={select} value={company} onChange={(e) => setCompany(e.target.value)}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <DialogFooter className="mt-2 flex-row justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Send invite</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
