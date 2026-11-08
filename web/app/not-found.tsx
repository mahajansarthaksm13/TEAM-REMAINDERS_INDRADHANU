import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-end gap-6 px-4 pb-16 sm:px-12">
      <p className="eyebrow text-dim">404</p>
      <h1 className="t-h1 max-w-xl">This page isn&apos;t in the ledger.</h1>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="dark"><Link href="/">Home</Link></Button>
        <Button asChild variant="darkGhost"><Link href="/app/live">Dashboard</Link></Button>
      </div>
    </main>
  )
}
