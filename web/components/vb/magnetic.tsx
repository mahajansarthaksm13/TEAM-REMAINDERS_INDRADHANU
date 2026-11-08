"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

// The reference's magnetic pull: the control leans toward the cursor as it approaches and
// springs back when it leaves. Visual only; the child keeps its own click and focus.
// ponytail: CSS transition with an overshoot curve instead of a spring library.
export function Magnetic({ children, radius = 90, strength = 0.35, max = 14, className }: { children: ReactNode; radius?: number; strength?: number; max?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(pointer: coarse)").matches) return
    const clamp = (v: number) => Math.max(-max, Math.min(max, v))
    let frame = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const near = Math.abs(dx) < r.width / 2 + radius && Math.abs(dy) < r.height / 2 + radius
        el.style.transform = near ? `translate(${clamp(dx * strength)}px, ${clamp(dy * strength)}px)` : ""
      })
    }
    const reset = () => (el.style.transform = "")
    window.addEventListener("pointermove", move, { passive: true })
    document.addEventListener("pointerleave", reset)
    window.addEventListener("blur", reset)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", move)
      document.removeEventListener("pointerleave", reset)
      window.removeEventListener("blur", reset)
    }
  }, [radius, strength, max])
  return (
    <span ref={ref} className={cn("inline-flex transition-transform duration-500 ease-(--ease-spring)", className)}>
      {children}
    </span>
  )
}

// Primary call to action: magnetic pull + flow sweep, optionally swept once on load.
export function Cta({ playOnLoad, magnetic = true, ...props }: React.ComponentProps<typeof Button> & { playOnLoad?: boolean; magnetic?: boolean }) {
  const [played, setPlayed] = useState(false)
  useEffect(() => {
    if (!playOnLoad || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const a = setTimeout(() => setPlayed(true), 300)
    const b = setTimeout(() => setPlayed(false), 1500)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [playOnLoad])
  const button = <Button data-played={played ? "true" : undefined} {...props} />
  return magnetic ? <Magnetic>{button}</Magnetic> : button
}
