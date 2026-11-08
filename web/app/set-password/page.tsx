import type { Metadata } from "next"
import { Wordmark } from "@/components/vb/brand"
import { SetPasswordForm } from "./set-password-form"

export const metadata: Metadata = { title: "Set your password" }

// Landing page for the invite email sent by /api/admin/invite.
export default function SetPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-12 sm:px-12">
      <Wordmark className="mb-10" />
      <div className="w-full max-w-[420px]">
        <h1 className="t-h2">Set your password</h1>
        <p className="mt-2 text-sm text-dim">You were invited to VeriBin. Choose a password, then log in.</p>
        <SetPasswordForm />
      </div>
    </main>
  )
}
