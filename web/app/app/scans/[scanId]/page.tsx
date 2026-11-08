import Link from "next/link"
import type { Metadata } from "next"
import { Badge, Card, CardHead, CategorySwatch, EmptyState, KV, PageHeader, TierBadge, WeightBadge } from "@/components/vb/ui"
import { ProofField, VerifySignature } from "@/components/vb/client"
import { href, pageCtx } from "@/lib/session"
import { CATEGORY_DESC, CATEGORY_LABEL, UUID_RE, cityName, reasonLabel, type Category, type Tier } from "@/lib/shared"
import { fmtDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Scan detail" }

export default async function ScanDetailPage({ params, searchParams }: { params: Promise<{ scanId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { scanId } = await params
  const { sb, sp } = await pageCtx(searchParams)
  const { data: d } = UUID_RE.test(scanId)
    ? await sb
        .from("scans")
        .select("*, products(name, unit_weight_g), bins(city, public_key), scan_flags(reason, severity)")
        .eq("id", scanId)
        .maybeSingle()
    : { data: null }
  if (!d || !d.products || !d.bins) {
    return (
      <>
        <PageHeader title="Scan detail" />
        <EmptyState action={<Link href={href("/app/scans", sp)} className="font-semibold text-olive-700 underline-offset-4 hover:underline">Back to scans</Link>}>Scan not found or not visible to you.</EmptyState>
      </>
    )
  }
  const s = d
  const p = d.products
  const category = s.category as Category
  const flags = d.scan_flags ?? []
  const diff = s.weight_g - p.unit_weight_g
  return (
    <>
      <PageHeader
        eyebrow={`${s.bin_id} · sequence ${s.sequence}`}
        title={p.name}
        desc={`Totals use the catalogue weight (${p.unit_weight_g} g), not the measured weight.`}
        actions={<Link href={href("/app/scans", sp)} className="text-sm font-semibold text-olive-700 underline-offset-4 hover:underline">← All scans</Link>}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHead eyebrow="Verify" title="Check the bin's signature yourself" />
          <VerifySignature recordText={s.record_text} signature={s.signature} publicKey={d.bins.public_key} />
        </Card>

        <Card>
          <CardHead eyebrow="Proof" title="Signed record and chain" />
          <div className="grid gap-4">
            <ProofField label="Signed text" value={s.record_text} />
            <ProofField label="Signature (Ed25519, base64)" value={s.signature} />
            <div className="grid gap-4 lg:grid-cols-3">
              <ProofField label="Record hash" value={s.record_hash} />
              <ProofField label="Previous hash" value={s.prev_chain_hash} />
              <ProofField label="Chain hash" value={s.chain_hash} />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHead eyebrow="Context" title="What was collected" />
            <KV
              items={[
                ["Product", p.name],
                ["Category", <span key="c" className="inline-flex items-center gap-2"><CategorySwatch category={category} />{CATEGORY_LABEL[category]} · {CATEGORY_DESC[category]}</span>],
                ["Bin", <Link key="b" href={href(`/app/bins/${s.bin_id}`, sp)} className="font-mono font-semibold text-olive-700 underline-offset-4 hover:underline">{s.bin_id} · {cityName(d.bins.city)}</Link>],
                ["Weight", <span key="w" className="tnum">{s.weight_g} g <span className="text-olive-700">vs catalogue {p.unit_weight_g} g ({diff >= 0 ? "+" : ""}{diff} g)</span></span>],
                ["Weight check", <WeightBadge key="ok" ok={s.weight_ok} />],
                ["Tier", <TierBadge key="t" tier={s.code_type as Tier} />],
                ["Product code", <span key="code" className="font-mono text-[13px]">{s.code}</span>],
                ["Scanned (bin clock)", fmtDateTime(s.scanned_at)],
                ["Received (server)", fmtDateTime(s.received_at)],
              ]}
            />
          </Card>
          <Card className="lg:col-span-5">
            <CardHead eyebrow="AI flags" title={flags.length ? "Under review" : "No flags"} />
            {flags.length === 0 ? (
              <p className="text-sm text-olive-700">The nightly detector found nothing unusual about this scan.</p>
            ) : (
              <ul className="space-y-3">
                {flags.map((f) => (
                  <li key={f.reason} className="flex items-start justify-between gap-3 rounded-[14px] border border-sage-200 p-3 text-sm">
                    <span>{reasonLabel(f.reason)}</span>
                    <Badge kind={f.severity === "high" ? "flagged" : "warning"}>{f.severity}</Badge>
                  </li>
                ))}
                <li className="text-xs text-olive-700">Flags never change the ledger. On reports, flagged scans are counted as under review; only a weight mismatch leaves a scan out of the totals.</li>
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
