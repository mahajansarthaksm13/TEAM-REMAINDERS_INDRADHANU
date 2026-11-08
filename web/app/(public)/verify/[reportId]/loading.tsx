import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[840px] flex-col items-start gap-4 px-4 py-16 sm:px-6" role="status">
      <Loader2 className="size-6 animate-spin text-dim" aria-hidden />
      <p className="t-h3">Rebuilding report from the ledger…</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-chip">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-lit" />
      </div>
    </div>
  )
}
