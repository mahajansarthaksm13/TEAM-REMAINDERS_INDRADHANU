import type { Metadata } from "next"
import { AuthShell } from "@/components/vb/auth-shell"
import { SetPasswordForm } from "./set-password-form"

export const metadata: Metadata = { title: "Set your password" }

// Landing page for the invite email sent by /api/admin/invite.
export default function SetPasswordPage() {
  return (
    <AuthShell eyebrow="Your invite" title="Set your password" desc="You were invited to VeriBin. Choose a password, then log in.">
      <SetPasswordForm />
    </AuthShell>
  )
}
