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

  useEffect(() => {
    client.auth.getSession().then(({ data }) => setReady(!!data.session))
  }, [client])

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
    router.push("/login")
  }

  if (ready === null) return <p className="mt-6 text-sm text-dim">Checking your invite…</p>
  if (!ready) return <div className="mt-6"><Notice kind="error">This invite link is invalid or has expired. Ask your admin for a new one.</Notice></div>
  return (
    <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
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
