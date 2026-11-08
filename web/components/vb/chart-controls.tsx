"use client"

import { useState } from "react"
import { cn } from "cn"
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/shared"
import { CategorySwatch } from "./ui"

// Filter controls shared by every chart. Toggle buttons (aria-pressed) in a labelled group, sized
// for touch (36px+), on the neumorphic ground: the chosen option sits raised in Violet.

export type Opt<T extends string> = { value: T; label: string }

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="neu-inset inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            o.value === value ? "btn-lit text-snow" : "text-dim hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Multi-select on/off chips. One option always stays on, so a chart is never empty by accident.
export function Chips<T extends string>({ label, all, on, onChange, render }: { label: string; all: readonly T[]; on: T[]; onChange: (v: T[]) => void; render: (v: T) => React.ReactNode }) {
  const toggle = (v: T) => {
    const next = on.includes(v) ? on.filter((x) => x !== v) : all.filter((x) => on.includes(x) || x === v)
    if (next.length > 0) onChange(next)
  }
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {all.map((v) => {
        const active = on.includes(v)
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(v)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-[box-shadow,color,opacity] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "neu-pill text-ink" : "neu-press text-dim opacity-70 hover:opacity-100"
            )}
          >
            {render(v)}
          </button>
        )
      })}
      {on.length < all.length && (
        <button type="button" onClick={() => onChange([...all])} className="h-9 px-2 text-xs font-semibold text-lit underline decoration-lit/40 decoration-2 underline-offset-4 hover:decoration-lit">
          Show all
        </button>
      )}
    </div>
  )
}

export function useCategories(initial: Category[] = CATEGORIES) {
  return useState<Category[]>(initial)
}

export function CategoryChips({ on, onChange, available = CATEGORIES }: { on: Category[]; onChange: (v: Category[]) => void; available?: Category[] }) {
  return (
    <Chips
      label="Show categories"
      all={available}
      on={on}
      onChange={onChange}
      render={(c) => (
        <>
          <CategorySwatch category={c} />
          {CATEGORY_LABEL[c].replace("Category ", "Cat. ")}
        </>
      )}
    />
  )
}

// Row that holds a chart's filters above it.
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">{children}</div>
}
