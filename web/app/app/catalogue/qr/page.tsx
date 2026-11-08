import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, DataTable, EmptyState, PageHeader } from "@/components/vb/ui"
import { HashChip } from "@/components/vb/client"
import { QrIssuer } from "@/components/vb/qr-issuer"
type Batch = { id: string; quantity: number; created_at: string; products: { name: string; product_code: string } | null }
import { href, pageCtx } from "@/lib/session"
import { fmtDateTime, num } from "@/lib/format"

export const metadata: Metadata = { title: "Issue QR codes" }

export default async function QrPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, user, sp } = await pageCtx(searchParams)
  if (user.role !== "company" || !user.company_id) return <><PageHeader title="Issue QR codes" /><EmptyState>Only company users can issue QR codes.</EmptyState></>
  const [{ data: approved }, { data: batchRows }] = await Promise.all([
    sb.from("products").select("id, name").eq("company_id", user.company_id).eq("approved", true).order("name"),
    sb.from("qr_batches").select("id, quantity, created_at, products!inner(name, product_code, company_id)").eq("products.company_id", user.company_id).order("created_at", { ascending: false }).limit(50),
  ])
  const batches = (batchRows ?? []) as unknown as Batch[]
  const link = "font-semibold text-dim underline-offset-4 hover:underline"
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Issue QR codes" desc="Each code is a one-time serial. A QR-tier scan counts once; a second scan of the same code is rejected." />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHead eyebrow="New batch" title="1 to 10,000 codes" />
          {!approved?.length ? (
            <EmptyState action={<Link href={href("/app/catalogue", sp)} className={link}>Go to Catalogue</Link>}>You need an approved product first.</EmptyState>
          ) : (
            <QrIssuer products={approved} printBase="/app/catalogue/qr" />
          )}
        </Card>
        <Card className="lg:col-span-7">
          <CardHead eyebrow="History" title="Issued batches" />
          {batches.length === 0 ? (
            <EmptyState>No batches yet.</EmptyState>
          ) : (
            <DataTable<Batch>
              caption="QR batches"
              rows={batches}
              rowKey={(b) => b.id}
              title={(b) => b.products?.name}
              cols={[
                { key: "p", label: "Product", cell: (b) => b.products?.name, hideMobile: true },
                { key: "id", label: "Batch", cell: (b) => <HashChip value={b.id} label="Batch ID" /> },
                { key: "n", label: "Codes", align: "right", cell: (b) => num(b.quantity) },
                { key: "at", label: "Issued", cell: (b) => <span className="whitespace-nowrap">{fmtDateTime(b.created_at)}</span> },
                {
                  key: "f",
                  label: "Files",
                  cell: (b) => (
                    <span className="flex gap-3 whitespace-nowrap">
                      <a href={`/api/qr/${b.id}/csv`} className={link}>CSV</a>
                      <Link href={`/app/catalogue/qr/${b.id}/print`} className={link}>Print</Link>
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </>
  )
}
