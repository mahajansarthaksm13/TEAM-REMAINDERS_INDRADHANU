import { Skeleton } from "@/components/ui/skeleton"

// Layout-shaped skeleton: summary → evidence → detail.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-6 h-10 w-64 rounded-[10px] bg-sage-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-card bg-sage-200" />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-card bg-sage-200 lg:col-span-5" />
        <Skeleton className="h-72 rounded-card bg-sage-200 lg:col-span-7" />
      </div>
    </div>
  )
}
