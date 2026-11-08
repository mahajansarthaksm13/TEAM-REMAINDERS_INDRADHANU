// Public pages: a thin progress bar and a skeleton in the shape of a page intro and cards.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-[1200px] px-4 pt-20 pb-16 sm:px-6">
      <div className="load-bar" aria-hidden />
      <div className="skel h-7 w-44 rounded-full" />
      <div className="skel mt-6 h-12 w-full max-w-xl" />
      <div className="skel mt-3 h-5 w-full max-w-md" />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skel h-44 rounded-card" />)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}
