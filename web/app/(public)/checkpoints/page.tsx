import type { Metadata } from "next"
import { PublicIntro, Section } from "@/components/vb/brand"
import { DataTable, EmptyState, Pagination } from "@/components/vb/ui"
import { HashChip } from "@/components/vb/client"
import { anonDb } from "@/lib/supabase"
import { checkpointUrl } from "@/lib/shared"
import { fmtDay } from "@/lib/format"

export const metadata: Metadata = { title: "Checkpoints" }

type Checkpoint = { day: string; hash: string; previous_hash: string | null }
const PER = 30

export default async function CheckpointsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1)
  // checkpoints is public by design (anon may read it).
  const { data, count, error } = await anonDb()
    .from("checkpoints")
    .select("day, hash, previous_hash", { count: "exact" })
    .order("day", { ascending: false })
    .range((page - 1) * PER, page * PER - 1)
  if (error) throw new Error("checkpoints failed")
  const rows = (data ?? []) as Checkpoint[]
  return (
    <>
      <PublicIntro eyebrow="Checkpoints" title="Sealed every night at 00:05 IST.">
        <p>Each checkpoint hashes the previous one with the head of every bin&apos;s chain. It is published to a public GitHub repository, so history can&apos;t be rewritten quietly.</p>
      </PublicIntro>
      <Section className="max-w-[960px]">
        {rows.length === 0 ? (
          <EmptyState>First checkpoint is published after 00:05 IST.</EmptyState>
        ) : (
          <>
            <DataTable<Checkpoint>
              caption="Daily checkpoints, newest first"
              rows={rows}
              rowKey={(r) => r.day}
              title={(r) => fmtDay(r.day)}
              cols={[
                { key: "day", label: "Day (IST)", cell: (r) => <span className="tnum">{fmtDay(r.day)}</span>, hideMobile: true },
                { key: "hash", label: "Checkpoint hash", cell: (r) => <HashChip value={r.hash} label="Checkpoint hash" /> },
                { key: "prev", label: "Previous", cell: (r) => (r.previous_hash ? <HashChip value={r.previous_hash} label="Previous checkpoint hash" /> : "—") },
                {
                  key: "gh",
                  label: "Proof",
                  align: "right",
                  cell: (r) => (
                    <a href={checkpointUrl(r.day)} target="_blank" rel="noreferrer" className="font-semibold text-dim underline-offset-4 hover:underline">
                      View on GitHub ↗
                    </a>
                  ),
                },
              ]}
            />
            <Pagination page={page} total={count ?? 0} per={PER} hrefFor={(p) => `/checkpoints?page=${p}`} />
          </>
        )}
        <details className="mt-10 text-sm text-dim">
          <summary className="cursor-pointer font-semibold text-ink">How to recompute a checkpoint</summary>
          <p className="mt-3 max-w-[68ch]">
            For every bin created before midnight IST at the end of the day, in bin-id order, take <code className="font-mono">&lt;bin_id&gt;=&lt;chain hash of its last scan received before that time&gt;</code> (64 zeros if none) and join them with <code className="font-mono">|</code>. The checkpoint hash is SHA-256 of <code className="font-mono">&lt;day&gt;|&lt;previous checkpoint hash&gt;|&lt;heads&gt;</code>.
          </p>
        </details>
      </Section>
    </>
  )
}
