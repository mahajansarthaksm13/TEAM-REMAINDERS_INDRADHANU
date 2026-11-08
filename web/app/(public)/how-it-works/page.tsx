import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"
import { Simulator } from "@/components/vb/simulator"
import { serviceDb } from "@/lib/supabase"
import { STEPS } from "@/lib/shared"

export const metadata: Metadata = { title: "How it works" }

const DETAIL: Record<number, string> = {
  1: "The bin reads the packet's code. QR packets carry a one-time serial issued to the producer; barcodes identify the product. A load cell records the weight in grams.",
  2: "The record — version, bin ID, sequence, time, code type, code, weight — is signed with the bin's private key. The public key is registered, so anyone can check the signature.",
  3: "On arrival the server checks the signature, then stores the record with the hash of the previous one. At 00:05 IST every bin's chain head is hashed into a checkpoint and published on GitHub.",
  4: "A report covers one category and period, using only checkpointed scans. Its fingerprint and checkpoint are printed with a QR code that rebuilds it from the ledger.",
}

export const dynamic = "force-dynamic"

// Latest demo-bin scans for the feed's first paint (anon cannot read scans; demo data only).
async function demoFeed() {
  try {
    const { data } = await serviceDb()
      .from("scans")
      .select("id, received_at, weight_g, bins!inner(is_demo)")
      .eq("bins.is_demo", true)
      .order("received_at", { ascending: false })
      .limit(8)
    return (data ?? []).map((s) => ({ scan_id: s.id, received_at: s.received_at, weight_g: s.weight_g }))
  } catch {
    return []
  }
}

export default async function HowItWorksPage() {
  return (
    <>
      <PublicIntro eyebrow="How it works" title="From packet to proof, step by step.">
        <p>Nothing here asks you to trust us. Each step leaves something you can check.</p>
      </PublicIntro>
      <Section>
        <ol className="grid gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} id={`step-${s.n}`} className="scroll-mt-24 rounded-card border border-sage-200 bg-surface p-6 lg:p-8">
              <span className="flex size-10 items-center justify-center rounded-full bg-olive-700 font-semibold text-garden-50">{s.n}</span>
              <h2 className="t-h3 mt-5">{s.title}</h2>
              <p className="mt-2 max-w-[56ch] text-olive-700">{DETAIL[s.n]}</p>
            </li>
          ))}
        </ol>
      </Section>
      <section id="simulator" className="scroll-mt-16 bg-sage-200/50">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
          <p className="eyebrow mb-3 text-olive-700">Website simulator</p>
          <h2 className="t-h2 max-w-2xl">Scan a sample packet. It goes through the real pipeline.</h2>
          <p className="mt-3 mb-8 max-w-[60ch] text-olive-700">The server signs your scan with the demo bin&apos;s key and sends it through the same ingest checks a physical bin uses. Demo scans never count toward any company&apos;s totals.</p>
          <Simulator initialFeed={await demoFeed()} />
        </div>
      </section>
    </>
  )
}
