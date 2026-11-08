"use client"

import { Button } from "@/components/ui/button"

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-[840px] flex-col items-start gap-4 px-4 py-16 sm:px-6" role="alert">
      <p className="t-h3">Couldn&apos;t load this page.</p>
      <p className="text-dim">Live numbers or verification couldn&apos;t run right now.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  )
}
