"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError, Notice } from "@/components/vb/ui"

// Admin invite links come back with the session in the URL hash (implicit flow),
// so this page uses its own implicit-flow client instead of the cookie client.
const sb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: false },
  })

export function SetPasswordForm() {
  const router = useRouter()
  const [client] = useState(sb)
  const [ready, setReady] = useState<boolean | null>(null)
  const [err, setErr] = useState("")
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    client.auth.getSession().then(({ data }) => setReady(!!data.session))
  }, [client])

  // After saving, show the tick drawing itself, then hand over to the login page.
  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => router.push("/login"), 1600)
    return () => clearTimeout(id)
  }, [saved, router])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const pw = String(f.get("password"))
    if (pw.length < 8) return setErr("Use at least 8 characters.")
    if (pw !== String(f.get("confirm"))) return setErr("The two passwords don't match.")
    setPending(true)
    const { error } = await client.auth.updateUser({ password: pw })
    setPending(false)
    if (error) return setErr("Couldn't set the password. Ask your admin for a new invite.")
    await client.auth.signOut()
    setSaved(true)
  }

  if (saved)
    return (
      <div role="status" className="reveal mt-8 flex flex-col items-center gap-4 text-center">
        <span className="neu flex size-16 items-center justify-center rounded-full text-lit">
          <svg viewBox="0 0 24 24" className="draw-tick size-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p className="font-semibold">Password saved.</p>
        <p className="text-sm text-dim">Taking you to log in…</p>
      </div>
    )
  if (ready === null)
    return (
      <p role="status" className="mt-6 flex items-center gap-2 text-sm text-dim">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking your invite…
      </p>
    )
  if (!ready) return <div className="reveal mt-6"><Notice kind="error">This invite link is invalid or has expired. Ask your admin for a new one.</Notice></div>
  return (
    <form onSubmit={submit} noValidate className="cascade mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Repeat password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </div>
      {err && <FieldError id="pw-err">{err}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save password</Button>
    </form>
  )
}
