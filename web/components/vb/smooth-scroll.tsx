"use client"

import { useEffect } from "react"
import Lenis from "lenis"

// Inertial scrolling (Lenis, as on the reference) plus fade-up reveals as blocks enter the view.
// Both stand down for prefers-reduced-motion: native scroll, everything visible at once.
const TARGETS = ".stagger > *, [data-reveal]"
// Native scroll inside these (dialogs, menus, toasts); Lenis stops while a dialog locks the page.
const NATIVE = '[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-sonner-toaster]'

export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const lenis = new Lenis({
      autoRaf: true,
      allowNestedScroll: true, // wide tables and the sidebar scroll on their own
      stopInertiaOnNavigate: true,
      prevent: (node) => node.matches(NATIVE),
    })
    const lock = new MutationObserver(() => (document.body.hasAttribute("data-scroll-locked") ? lenis.stop() : lenis.start()))
    lock.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] })

    // Reveal: each batch that comes into view rises in order, 70 ms apart.
    const seen = new WeakSet<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const el = e.target as HTMLElement
            el.style.setProperty("--d", `${Math.min(i, 6) * 70}ms`)
            el.classList.add("is-in")
            io.unobserve(el)
          })
      },
      { rootMargin: "0px 0px -6% 0px" }
    )
    const scan = () =>
      document.querySelectorAll(TARGETS).forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        io.observe(el)
      })
    scan()
    document.documentElement.classList.add("fx")
    // Client navigation and streamed sections add blocks later.
    let queued = 0
    const added = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), scan()))
    })
    added.observe(document.body, { childList: true, subtree: true })

    return () => {
      lock.disconnect()
      added.disconnect()
      io.disconnect()
      cancelAnimationFrame(queued)
      document.documentElement.classList.remove("fx")
      lenis.destroy()
    }
  }, [])
  return null
}
