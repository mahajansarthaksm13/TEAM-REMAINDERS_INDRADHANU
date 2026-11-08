"use client"

import { useActionState, useState } from "react"
import { Loader2 } from "lucide-react"
import { FieldError } from "@/components/vb/ui"
import { Cta } from "@/components/vb/magnetic"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, type LoginState } from "@/lib/actions"

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})
  const [errs, setErrs] = useState<{ email?: string; password?: string }>({})

  function validate(e: React.FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget)
    const n: typeof errs = {}
    if (!String(f.get("email")).trim()) n.email = "Enter your email."
    if (!String(f.get("password"))) n.password = "Enter your password."
    setErrs(n)
    if (n.email || n.password) e.preventDefault()
  }

  return (
    <>
      {notice && !state.error && <p role="status" className="mt-6 rounded-[14px] bg-chip px-4 py-3 text-sm">{notice}</p>}
      <form action={action} onSubmit={validate} noValidate className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" defaultValue={state.email} aria-invalid={!!errs.email || undefined} aria-describedby={errs.email ? "email-err" : undefined} />
          {errs.email && <FieldError id="email-err">{errs.email}</FieldError>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" aria-invalid={!!errs.password || undefined} aria-describedby={errs.password ? "pw-err" : undefined} />
          {errs.password && <FieldError id="pw-err">{errs.password}</FieldError>}
        </div>
        {state.error && <FieldError id="form-err">{state.error}</FieldError>}
        <Cta type="submit" size="lg" disabled={pending} magnetic={false} className="mt-2 w-full">
          {pending && <Loader2 className="animate-spin" />}Log in
        </Cta>
      </form>
      <p className="mt-4 text-sm text-dim">Forgot your password? Ask your admin to reset it.</p>
    </>
  )
}
