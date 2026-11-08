// Dashboard skeleton in the shape of the Live page: headline + KPIs, then two rows of cards.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="load-bar" aria-hidden />
      <div className="skel mb-2 h-4 w-40" />
      <div className="skel mb-6 h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="skel col-span-2 h-40 rounded-card" />
        {[0, 1, 2].map((i) => <div key={i} className="skel h-40 rounded-card" />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="neu rounded-card p-6 lg:col-span-5">
          <div className="skel h-5 w-32" />
          <div className="mt-6 flex h-44 items-end justify-between gap-3">
            {[45, 70, 55, 80, 60, 90, 75].map((h, i) => <div key={i} className="skel w-3.5 rounded-full" style={{ height: `${h}%` }} />)}
          </div>
        </div>
        <div className="neu rounded-card p-6 lg:col-span-7">
          <div className="skel h-5 w-48" />
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-10" />)}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading the latest figures…</span>
    </div>
  )
}
