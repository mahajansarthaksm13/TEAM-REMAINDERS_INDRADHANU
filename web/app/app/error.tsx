"use client"

import { Button } from "@/components/ui/button"

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 neu rounded-card p-6">
      <p className="text-lg font-semibold">Couldn&apos;t load. Retry.</p>
      <p className="text-sm text-dim">Nothing was changed. Try again, or pick another period.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  )
}
