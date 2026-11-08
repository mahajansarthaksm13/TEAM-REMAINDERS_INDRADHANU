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
    <header className="dark-band sticky top-0 z-40 border-b border-olive-700/60 bg-olive-950/95 backdrop-blur no-print">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path.startsWith(href) ? "page" : undefined}
              className={cn("rounded-full px-3 py-2 text-sm text-garden-50/80 transition-colors hover:text-garden-50", path.startsWith(href) && "bg-olive-700/60 text-garden-50")}
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
          <SheetContent side="left" className="dark-band w-[min(86vw,320px)] border-olive-700 bg-olive-950 p-6 text-garden-50">
            <SheetTitle className="font-display text-[28px] font-normal text-garden-50">VeriBin</SheetTitle>
            <nav aria-label="Main" className="flex flex-col gap-1">
              <Link href="/" className="rounded-full px-3 py-3 text-garden-50/90 hover:bg-olive-700">Home</Link>
              {LINKS.map(([href, label]) => (
                <Link key={href} href={href} className={cn("rounded-full px-3 py-3 text-garden-50/90 hover:bg-olive-700", path.startsWith(href) && "bg-olive-700 text-garden-50")}>
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
