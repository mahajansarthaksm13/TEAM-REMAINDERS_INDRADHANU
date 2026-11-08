import type { Metadata } from "next"
import { AuthShell } from "@/components/vb/auth-shell"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Log in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const notice = error === "no_profile" ? "Your account isn't set up yet. Contact your admin." : next ? "Log in to continue." : undefined
  return (
    <AuthShell eyebrow="Welcome back" title="Log in" desc="Accounts are created by your VeriBin admin.">
      <LoginForm next={next ?? ""} notice={notice} />
    </AuthShell>
  )
}
