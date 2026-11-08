"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { browserDb } from "@/lib/supabase-browser"
import { cityName, type Category, type FeedRow, type Tier } from "@/lib/shared"
import { fmtTime } from "@/lib/format"
import { Badge, CategorySwatch, TierBadge } from "./ui"

type Status = "live" | "reconnecting" | "polling"

const COLS = "id, bin_id, category, weight_g, weight_ok, code_type, scanned_at, received_at, products(name), bins(city), scan_flags(reason)"

// A8: private broadcast channel company:<id> (event "scan"). The payload carries ids only,
// so each new scan is read back through RLS for its product name and city.
// "All companies" scope does not subscribe: it refreshes every 60 s.
export function LiveFeed({ initial, companyId, scanHref }: { initial: FeedRow[]; companyId: string | null; scanHref: string }) {
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [fresh, setFresh] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(companyId ? "reconnecting" : "polling")

  useEffect(() => {
    const silent = setInterval(() => router.refresh(), 60_000)
    if (!companyId) return () => clearInterval(silent)
    const sb = browserDb()
    let channel: ReturnType<typeof sb.channel> | undefined
    let alive = true
    ;(async () => {
      const { data } = await sb.auth.getSession()
      if (!alive) return
      await sb.realtime.setAuth(data.session?.access_token ?? null)
      channel = sb
        .channel(`company:${companyId}`, { config: { private: true } })
        .on("broadcast", { event: "scan" }, async ({ payload }) => {
          const { data: s } = await sb.from("scans").select(COLS).eq("id", payload.scan_id).maybeSingle()
          if (!s) return
          const r = s as unknown as {
            id: string; bin_id: string; category: string; weight_g: number; weight_ok: boolean | null; code_type: string
            scanned_at: string; received_at: string; products: { name: string } | null; bins: { city: string } | null; scan_flags: { reason: string }[] | null
          }
          const row: FeedRow = {
            scan_id: r.id, bin_id: r.bin_id, city: r.bins?.city ?? "", product_name: r.products?.name ?? "Unknown product",
            category: r.category as Category, weight_g: r.weight_g, tier: r.code_type as Tier, weight_ok: r.weight_ok,
            flagged: (r.scan_flags?.length ?? 0) > 0, scanned_at: r.scanned_at, received_at: r.received_at,
          }
          setRows((cur) => [row, ...cur.filter((x) => x.scan_id !== row.scan_id)].slice(0, 50))
          setFresh(row.scan_id)
          router.refresh() // bump KPIs and category bars
        })
        .subscribe((st) => setStatus(st === "SUBSCRIBED" ? "live" : st === "CHANNEL_ERROR" ? "polling" : "reconnecting"))
    })()
    return () => {
      alive = false
      clearInterval(silent)
      if (channel) sb.removeChannel(channel)
    }
  }, [companyId, router])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="eyebrow text-olive-700">Live scan feed · latest 50</p>
        {status === "live" && <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"><span className="soft-pulse size-2 rounded-full bg-success" />Live</span>}
        {status === "polling" && <span className="rounded-full bg-sage-200 px-2.5 py-1 text-xs font-semibold">Refreshes every 60 s</span>}
        {status === "reconnecting" && <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Reconnecting…</span>}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-sage-600/60 px-4 py-10 text-center text-sm text-olive-700">Waiting for the first scan…</p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-sage-200 overflow-y-auto pr-1" aria-live="polite" aria-relevant="additions">
          {rows.map((r) => (
            <li key={r.scan_id} className={cn(fresh === r.scan_id && "feed-in")}>
              <Link href={`/app/scans/${r.scan_id}${scanHref}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-[10px] px-2 py-2.5 text-sm hover:bg-garden-50">
                <span className="tnum text-xs text-olive-700">{fmtTime(r.received_at)}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <CategorySwatch category={r.category} />
                  <span className="truncate font-semibold">{r.product_name}</span>
                </span>
                <span className="tnum text-right">{r.weight_g} g</span>
                <span />
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-olive-700">
                  <span className="font-mono">{r.bin_id}</span> · {cityName(r.city)}
                  <TierBadge tier={r.tier} />
                  {r.weight_ok === false && <Badge kind="mismatch">⚠ Weight</Badge>}
                  {r.flagged && <Badge kind="flagged">✗ Flagged</Badge>}
                </span>
                <span />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
