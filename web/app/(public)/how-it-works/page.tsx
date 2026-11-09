import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"
import Link from "next/link"
import { STEPS } from "@/lib/shared"

export const metadata: Metadata = { title: "How it works" }

const DETAIL: Record<number, string> = {
  1: "The bin reads the packet's code. QR packets carry a one-time serial issued to the producer; barcodes identify the product. A load cell records the weight in grams.",
  2: "The record — version, bin ID, sequence, time, code type, code, weight — is signed with the bin's private key. The public key is registered, so anyone can check the signature.",
  3: "On arrival the server checks the signature, then stores the record with the hash of the previous one. At 00:05 IST every bin's chain head is hashed into a checkpoint and published on GitHub.",
  4: "A report covers one category and period, using only checkpointed scans. Its fingerprint and checkpoint are printed with a QR code that rebuilds it from the ledger.",
}

export default function HowItWorksPage() {
  return (
    <>
      <PublicIntro eyebrow="How it works" title="From packet to proof, step by step.">
        <p>Nothing here asks you to trust us. Each step leaves something you can check.</p>
      </PublicIntro>
      <Section>
        <ol className="grid gap-6 md:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} id={`step-${s.n}`} className="scroll-mt-24 neu rounded-card p-6 lg:p-8">
              <span className="flex size-10 items-center justify-center rounded-full bg-lit font-bold text-on-lit">{s.n}</span>
              <h2 className="t-h3 mt-5">{s.title}</h2>
              <p className="mt-2 max-w-[56ch] text-dim">{DETAIL[s.n]}</p>
            </li>
          ))}
        </ol>
      </Section>
      <section id="simulator" className="scroll-mt-16">
        <div className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="neu flex flex-col gap-5 rounded-card p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div>
              <p className="eyebrow mb-2 text-dim">Simulation Studio</p>
              <h2 className="t-h2 max-w-2xl">Watch a smart bin decide what counts.</h2>
              <p className="mt-3 max-w-[60ch] text-dim">Scan a code, open the lid, drop the item past the camera and the scale, and see the real server decide. Five one-click scenarios: genuine, fake code, no deposit, reused code and wrong weight.</p>
            </div>
            <Link href="/simulator" className="btn-lit inline-flex h-11 shrink-0 items-center justify-center rounded-full px-6 font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">Open the simulator</Link>
          </div>
        </div>
      </section>
    </>
  )
}
