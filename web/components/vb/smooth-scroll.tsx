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

    // Reveal: each batch that comes into view rises in order, 70 ms apart. Done with the Web
    // Animations API, never classes or inline styles: the server HTML may still be hydrating, and
    // touching its attributes would make React report a hydration mismatch (or later reset them).
    const held = new WeakMap<Element, Animation>() // "hidden until seen"
    const io = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const el = e.target
            io.unobserve(el)
            held.get(el)?.cancel()
            // fill "backwards" only: once played, the block's own hover transforms work untouched
            el.animate(
              [
                { opacity: 0, transform: "translateY(18px)", filter: "blur(6px)" },
                { opacity: 1, transform: "none", filter: "none" },
              ],
              { duration: 800, delay: Math.min(i, 6) * 70, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" }
            )
          })
      },
      { rootMargin: "0px 0px -6% 0px" }
    )
    const scan = () =>
      document.querySelectorAll(TARGETS).forEach((el) => {
        if (held.has(el)) return
        held.set(el, el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" }))
        io.observe(el)
      })
    scan()
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
      document.querySelectorAll(TARGETS).forEach((el) => held.get(el)?.cancel())
      lenis.destroy()
    }
  }, [])
  return null
}
