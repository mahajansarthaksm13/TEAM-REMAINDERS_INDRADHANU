import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"
import { Studio, type DemoProduct, type FeedItem } from "@/components/vb/sim/studio"
import { serviceDb } from "@/lib/supabase"
import { DEMO_BIN } from "@/lib/demo-bin"
import type { Category } from "@/lib/shared"

export const metadata: Metadata = {
  title: "Simulator",
  description: "Watch a VeriBin smart bin decide what counts: scan, lid, camera, scale, and the real signed ledger.",
}
export const dynamic = "force-dynamic"

// Demo data only, read with the service role (visitors cannot read scans). The demo company
// and bin are excluded from every company dashboard and from national totals.
async function load() {
  try {
    const db = serviceDb()
    await db.rpc("ensure_demo_catalogue")
    const [{ data: bin }, { data: scans }] = await Promise.all([
      db.from("bins").select("company_id").eq("id", DEMO_BIN).maybeSingle(),
      db.from("scans").select("id, received_at, weight_g, product_id, code").eq("bin_id", DEMO_BIN).order("received_at", { ascending: false }).limit(8),
    ])
    if (!bin) return null
    const { data: products } = await db
      .from("products")
      .select("id, product_code, name, category, unit_weight_g")
      .eq("company_id", bin.company_id)
      .eq("approved", true)
      .order("category")
    return {
      products: (products ?? []).map((p): DemoProduct => ({ id: p.id, code: p.product_code, name: p.name, category: p.category as Category, unit_weight_g: p.unit_weight_g })),
      feed: (scans ?? []).map((s): FeedItem => ({ scan_id: s.id, at: s.received_at, weight_g: s.weight_g, product_id: s.product_id })),
      lastUsedCode: scans?.find((s) => s.code.startsWith("VBQ1."))?.code ?? null,
    }
  } catch {
    return null
  }
}

const CHAIN = ["Deposit verified", "Pickup", "Transport", "Recycler receipt", "Processing"]

export default async function SimulatorPage() {
  const data = await load()
  return (
    <>
      <PublicIntro eyebrow="Simulation Studio" title="A scan is not a deposit. Watch the bin decide what counts.">
        <p>
          Today a scan or a certificate is often counted as collected plastic. In VeriBin a QR scan only <b>unlocks</b> the bin. The deposit counts only after
          the bin&apos;s camera sees the item go in and the scale confirms its weight, and every counted deposit is signed and chained so anyone can check it.
        </p>
        <p className="mt-3 text-sm text-dim">
          The bin&apos;s hardware is simulated in your browser and labelled as such. The rest is real: the server&apos;s decisions, the signed ledger, the hash chain
          and the live feed. Demo deposits use bin {DEMO_BIN} and never count toward company or national totals.
        </p>
      </PublicIntro>

      <Section className="!pt-0">
        {data ? (
          <Studio products={data.products} initialFeed={data.feed} lastUsedCode={data.lastUsedCode} />
        ) : (
          <div className="neu rounded-card p-6 text-sm">The demo bin isn&apos;t set up on this server yet, so the simulator can&apos;t run here.</div>
        )}

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="neu rounded-card p-4 sm:p-6 lg:col-span-7">
            <p className="eyebrow text-dim">The rule the bin follows</p>
            <ol className="mt-3 grid gap-2 text-sm">
              <li><b>1. Scan.</b> Only a code VeriBin issued, and never used before, can open the lid. Anything else: the lid stays shut and nothing is recorded.</li>
              <li><b>2. Pending.</b> Opening creates a pending entry. A pending entry is never counted.</li>
              <li><b>3. Verify.</b> The camera must see the item cross the opening, and the scale must move.</li>
              <li><b>4. Decide.</b> The server applies the deposit policy. Only then does the bin sign the record and the ledger chain it.</li>
              <li><b>5. Weight check.</b> A weight outside tolerance (more than 30% or 3 g off) is kept as evidence but flagged for review and left out of reports.</li>
            </ol>
          </div>
          <div className="neu rounded-card p-4 sm:p-6 lg:col-span-5">
            <p className="eyebrow text-dim">What happens next in a real network</p>
            <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {CHAIN.map((c, i) => (
                <li key={c} className="flex items-center gap-2">
                  <span className={i === 0 ? "rounded-badge bg-violet px-2 py-1 font-semibold text-snow" : "rounded-badge border border-dashed border-line-strong px-2 py-1 text-dim"}>{c}</span>
                  {i < CHAIN.length - 1 && <span className="text-dim" aria-hidden>→</span>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-dim">
              Shown here: the verified deposit. Pickup, transport, recycler receipt and processing are separate records on the roadmap. A deposit is evidence of
              collection, not proof of recycling.
            </p>
          </div>
        </div>
      </Section>
    </>
  )
}
