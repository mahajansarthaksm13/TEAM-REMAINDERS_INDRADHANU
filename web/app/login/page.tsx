import type { Metadata } from "next"
import { MossBackdrop, Wordmark } from "@/components/vb/brand"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Log in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const notice = error === "no_profile" ? "Your account isn't set up yet. Contact your admin." : next ? "Log in to continue." : undefined
  return (
    <main className="grid min-h-dvh lg:grid-cols-12">
      <aside className="dark-band relative isolate hidden flex-col justify-between p-12 lg:col-span-5 lg:flex">
        <MossBackdrop />
        <Wordmark className="relative" />
        <div className="relative">
          <p className="t-h1 max-w-md">Every number has a receipt.</p>
          <p className="mt-4 max-w-sm text-sage-500">Signed scans, a public chain, reports anyone can rebuild.</p>
        </div>
      </aside>
      <div className="flex flex-col justify-center px-4 py-12 sm:px-12 lg:col-span-7 lg:px-24">
        <Wordmark className="mb-10 lg:hidden" />
        <div className="w-full max-w-[420px]">
          <h1 className="t-h2">Log in</h1>
          <p className="mt-2 text-sm text-olive-700">Accounts are created by your VeriBin admin.</p>
          <LoginForm next={next ?? ""} notice={notice} />
        </div>
      </div>
    </main>
  )
}
