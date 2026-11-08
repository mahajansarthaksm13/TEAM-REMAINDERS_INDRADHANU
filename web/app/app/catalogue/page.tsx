import Link from "next/link"
import type { Metadata } from "next"
import { Badge, Card, CategorySwatch, DataTable, EmptyState, PageHeader } from "@/components/vb/ui"
import { AddProductDialog } from "@/components/vb/catalogue-client"
import { Button } from "@/components/ui/button"
import type { Category } from "@/lib/shared"

type Product = { id: string; company_id: string; product_code: string; name: string; barcode: string | null; category: Category; unit_weight_g: number; approved: boolean }
import { href, pageCtx } from "@/lib/session"
import { CATEGORY_LABEL } from "@/lib/shared"

export const metadata: Metadata = { title: "Catalogue" }

export default async function CataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, user, companies, sp } = await pageCtx(searchParams)
  if (user.role === "auditor" || user.role === "regulator")
    return <><PageHeader title="Catalogue" /><EmptyState>The catalogue isn&apos;t available for your role.</EmptyState></>

  const isAdmin = user.role === "admin"
  // RLS: a company sees its own products, an admin sees all of them.
  const { data } = await sb.from("products").select("id, company_id, product_code, name, barcode, category, unit_weight_g, approved").order("product_code")
  const demo = new Set((await sb.from("companies").select("id").eq("is_demo", true)).data?.map((c) => c.id) ?? [])
  const rows = ((data ?? []) as Product[]).filter((p) => !demo.has(p.company_id))
  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "—"
  const pending = rows.filter((p) => !p.approved).length
  return (
    <>
      <PageHeader
        title="Catalogue"
        desc="Products and their catalogue weights. Scans are checked against these weights."
        actions={
          isAdmin ? (
            <Button asChild><Link href={href("/app/catalogue/approvals", sp)}>Approval queue{pending > 0 && ` (${pending})`}</Link></Button>
          ) : (
            <>
              <AddProductDialog />
              <Button asChild variant="secondary"><Link href={href("/app/catalogue/qr", sp)}>Issue QR codes</Link></Button>
            </>
          )
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState>No products yet. Add your first product.</EmptyState>
        ) : (
          <DataTable<Product>
            caption="Products"
            rows={rows}
            rowKey={(r) => r.id}
            title={(r) => r.name}
            cols={[
              { key: "name", label: "Name", cell: (r) => <span className="font-semibold">{r.name}</span>, hideMobile: true },
              { key: "code", label: "Code", cell: (r) => <span className="font-mono text-[13px]">{r.product_code}</span> },
              ...(isAdmin ? [{ key: "co", label: "Company", cell: (r: Product) => companyName(r.company_id) }] : []),
              { key: "bc", label: "Barcode", cell: (r) => <span className="font-mono text-[13px]">{r.barcode ?? "—"}</span> },
              { key: "cat", label: "Category", cell: (r) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CategorySwatch category={r.category} />{CATEGORY_LABEL[r.category]}</span> },
              { key: "w", label: "Weight (g)", align: "right", cell: (r) => r.unit_weight_g },
              { key: "st", label: "Status", cell: (r) => (r.approved ? <Badge kind="approved">Approved</Badge> : <Badge kind="pending">Pending approval</Badge>) },
            ]}
          />
        )}
      </Card>
    </>
  )
}
