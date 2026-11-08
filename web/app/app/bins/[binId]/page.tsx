import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, EmptyState, KV, PageHeader, ScoreText, StatusBadge } from "@/components/vb/ui"
import { HashChip } from "@/components/vb/client"
import { ScoreChart } from "@/components/vb/charts"
import { VerifyChain } from "@/components/vb/verify-chain"
import { binList, openAlerts } from "@/lib/data"
import { ALERT_LABEL, cityName, humanize, reasonLabel, type ScoreReason } from "@/lib/shared"
import { href, pageCtx } from "@/lib/session"
import { fmtDateTime, fmtDay, num, timeAgo } from "@/lib/format"

export const metadata: Metadata = { title: "Bin detail" }

const daysBefore = (day: string, n: number) => new Date(Date.parse(day) - n * 86_400_000).toISOString().slice(0, 10)

export default async function BinDetailPage({ params, searchParams }: { params: Promise<{ binId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { binId } = await params
  const { sb, sp } = await pageCtx(searchParams)
  const b = (await binList(sb, null)).find((x) => x.bin_id === binId)
  if (!b) return <><PageHeader title="Bin detail" back={{ href: href("/app/bins", sp), label: "All bins" }} /><EmptyState>No bin with this ID, or it is not visible to you.</EmptyState></>
  const [{ data: keyRow }, { data: scoreRows }, allAlerts] = await Promise.all([
    sb.from("bins").select("public_key").eq("id", binId).maybeSingle(),
    sb.from("bin_scores").select("day, score, reasons, scans_considered").eq("bin_id", binId).order("day", { ascending: false }).limit(90),
    openAlerts(sb, null),
  ])
  const scores = (scoreRows ?? []).map((r) => ({ day: r.day, score: r.score, reasons: (r.reasons as ScoreReason[] | null) ?? [] }))
  const alerts = allAlerts.filter((a) => a.bin_id === binId)
  const withReasons = scores.filter((s) => s.reasons.some((r) => r.code !== "NOT_ENOUGH_DATA")).slice(0, 12)

  return (
    <>
      <PageHeader eyebrow={cityName(b.city)} title={b.bin_id} back={{ href: href("/app/bins", sp), label: "All bins" }} />

      <Card>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <KV
              items={[
                ["Status", <StatusBadge key="s" status={b.status} quiet={b.quiet} />],
                ["Last seen", b.last_seen ? `${fmtDateTime(b.last_seen)} · ${timeAgo(b.last_seen)}` : "Never reported"],
                ["Last sequence", <span key="q" className="tnum">{num(b.last_sequence)}</span>],
                ["Trust score", <ScoreText key="t" score={b.trust_score} />],
                ["Public key", <HashChip key="k" value={keyRow?.public_key ?? ""} label="Public key" />],
              ]}
            />
          </div>
          <div className="lg:col-span-5">
            <p className="mb-3 text-sm text-dim">Recomputes every record hash and link in this bin&apos;s chain, from the first scan to the latest.</p>
            <VerifyChain binId={b.bin_id} scanHref={href("", sp)} />
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead eyebrow="Trust score" title="Last 90 days" />
          {scores.length === 0 ? (
            <EmptyState>Not enough data. The nightly analysis scores a bin once it has 20 scans in the last 90 days.</EmptyState>
          ) : (
            <>
              <ScoreChart data={[...scores].reverse().map((s) => ({ day: s.day, score: s.score }))} />
              <p className="eyebrow mt-6 mb-2 text-dim">Deductions (each score covers the 90 days before it)</p>
              {withReasons.length === 0 ? (
                <p className="text-sm text-dim">No deductions in this window.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {withReasons.map((s) => (
                    <li key={s.day} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm">
                        <span className="tnum font-semibold">{fmtDay(s.day)}</span> · score <ScoreText score={s.score} />
                      </span>
                      <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {s.reasons.map((r) => (
                          <Link key={r.code} href={href("/app/scans", sp, { bin: b.bin_id, from: daysBefore(s.day, 90), to: s.day })} title={r.detail} className="text-dim underline-offset-4 hover:underline">
                            {reasonLabel(r.code)} (−{Math.round(r.points)})
                          </Link>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
        <Card className="lg:col-span-4">
          <CardHead eyebrow="Open alerts" title={alerts.length ? `${alerts.length} open` : "None"} />
          {alerts.length === 0 ? (
            <p className="text-sm text-dim">No open alerts for this bin.</p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-[14px] border border-line p-3 text-sm">
                  <p className={a.kind === "chain_break" ? "eyebrow text-error" : "eyebrow text-warning"}>{a.kind === "chain_break" ? "✗" : "⚠"} {ALERT_LABEL[a.kind] ?? a.kind}</p>
                  <p className="mt-1 font-semibold">{humanize(a.message)}</p>
                  <p className="mt-1 text-xs text-dim">{fmtDateTime(a.opened_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
