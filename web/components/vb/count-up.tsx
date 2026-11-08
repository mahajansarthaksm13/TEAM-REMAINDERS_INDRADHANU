"use client"

import { useLayoutEffect, useRef } from "react"

// Counts a displayed figure up from zero when it first appears ("83.4 kg", "4,490", "57%").
// The server renders the final value, screen readers always get the final value, and nothing
// animates for reduced motion or in a background tab (where frames would never arrive).
export function CountUp({ value, className, duration = 900 }: { value: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const m = value.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/)
    if (!el || !m || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const [, pre, digits, post] = m
    const target = Number(digits.replace(/,/g, ""))
    if (!Number.isFinite(target) || target === 0) return
    const decimals = digits.includes(".") ? digits.split(".")[1].length : 0
    const fmt = (n: number) => pre + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + post
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      el.textContent = p < 1 ? fmt(target * (1 - Math.pow(1 - p, 3))) : value
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    el.textContent = fmt(0)
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.textContent = value
    }
  }, [value, duration])
  return (
    <>
      <span ref={ref} aria-hidden className={className}>{value}</span>
      <span className="sr-only">{value}</span>
    </>
  )
}
