"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Wordmark } from "./brand"

const LINKS = [
  ["/live-data", "Live Data"],
  ["/ai-insights", "AI Insights"],
  ["/reports", "Reports"],
  ["/how-it-works", "How it works"],
  ["/checkpoints", "Checkpoints"],
  ["/about", "About"],
] as const

export function PublicHeader({ loggedIn }: { loggedIn: boolean }) {
  const path = usePathname()
  const cta = loggedIn ? (
    <Button asChild variant="dark" size="sm"><Link href="/app/live">Open dashboard</Link></Button>
  ) : (
    <Button asChild variant="dark" size="sm"><Link href="/login">Log in</Link></Button>
  )
  return (
    <header className="sticky top-0 z-40 border-b neu-bar no-print">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="neu-pill hidden items-center gap-0.5 rounded-full p-1 lg:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
              className={cn("rounded-full px-3.5 py-1.5 text-sm text-ink/75 transition-colors duration-200 hover:bg-snow/5 hover:text-ink", path.startsWith(href) && "bg-violet text-snow shadow-[inset_0_1px_0_rgba(251,251,251,0.2)] hover:bg-violet")}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:block">{cta}</div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="darkGhost" size="icon" className="border-0 lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(86vw,320px)] neu-bar p-6 text-ink">
            <SheetTitle className="font-display text-[28px] font-normal text-ink">VeriBin</SheetTitle>
            <nav aria-label="Main" className="flex flex-col gap-1">
              <Link href="/" aria-current={path === "/" ? "page" : undefined} className={cn("rounded-full px-3 py-3 text-ink/90 hover:bg-panel-hi", path === "/" && "bg-violet text-snow")}>Home</Link>
              {LINKS.map(([href, label]) => (
                <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined} className={cn("rounded-full px-3 py-3 text-ink/90 hover:bg-panel-hi", path.startsWith(href) && "bg-violet text-snow")}>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-4">{cta}</div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
