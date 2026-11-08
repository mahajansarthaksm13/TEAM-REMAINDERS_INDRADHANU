import type { Metadata } from "next"
import { GlowBackdrop, Wordmark } from "@/components/vb/brand"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Log in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const notice = error === "no_profile" ? "Your account isn't set up yet. Contact your admin." : next ? "Log in to continue." : undefined
  return (
    <main className="grid min-h-dvh lg:grid-cols-12">
      <aside className="relative isolate hidden flex-col justify-between border-r border-line p-12 lg:col-span-5 lg:flex">
        <GlowBackdrop />
        <Wordmark className="relative" />
        <div className="relative">
          <p className="t-h1 reveal max-w-md">Every number has a receipt.</p>
          <p className="eyebrow reveal mt-6 max-w-sm leading-6 text-dim" style={{ animationDelay: "150ms" }}>Signed scans · a public chain · reports anyone can rebuild</p>
        </div>
      </aside>
      <div className="flex flex-col items-center justify-center px-4 py-12 sm:px-12 lg:col-span-7">
        <Wordmark className="mb-10 lg:hidden" />
        <div className="glass reveal w-full max-w-[440px] rounded-card p-6 sm:p-8">
          <h1 className="t-h2">Log in</h1>
          <p className="mt-2 text-sm text-dim">Accounts are created by your VeriBin admin.</p>
          <LoginForm next={next ?? ""} notice={notice} />
        </div>
      </div>
    </main>
  )
}
