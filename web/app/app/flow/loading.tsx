// Flow page skeleton: KPIs, then an insights list beside the flow chart's three columns.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="load-bar" aria-hidden />
      <div className="skel mb-2 h-4 w-40" />
      <div className="skel mb-6 h-9 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-32 rounded-card" />)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="neu space-y-4 rounded-card p-6 lg:col-span-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-12" />)}
        </div>
        <div className="neu flex h-80 items-stretch justify-between gap-6 rounded-card p-6 lg:col-span-8">
          <div className="skel w-4 rounded-full" />
          <div className="flex flex-col justify-between gap-4 py-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skel h-12 w-4 rounded-full" />)}</div>
          <div className="skel w-4 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Tracing where the waste went…</span>
    </div>
  )
}
