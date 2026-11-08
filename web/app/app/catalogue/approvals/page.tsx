import type { Metadata } from "next"
import { Card, CategorySwatch, DataTable, EmptyState, PageHeader } from "@/components/vb/ui"
import { ApproveButton } from "@/components/vb/catalogue-client"
import type { Category } from "@/lib/shared"

type Product = { id: string; company_id: string; product_code: string; name: string; barcode: string | null; category: Category; unit_weight_g: number; created_at: string; companies: { name: string } | null }
import { href, pageCtx } from "@/lib/session"
import { CATEGORY_LABEL } from "@/lib/shared"
import { fmtDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Approval queue" }

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { sb, user, sp } = await pageCtx(searchParams)
  const back = { href: href("/app/catalogue", sp), label: "Catalogue" }
  if (user.role !== "admin") return <><PageHeader title="Approval queue" back={back} /><EmptyState>Only admins can approve products.</EmptyState></>
  const { data } = await sb.from("products").select("id, company_id, product_code, name, barcode, category, unit_weight_g, created_at, companies(name)").eq("approved", false).order("created_at")
  const rows = (data ?? []) as unknown as Product[]
  return (
    <>
      {/* Reject / unapprove behaviour is [FILL] in the App Flow — not built. */}
      <PageHeader back={back} title="Approval queue" desc="Check the catalogue weight against a physical sample before approving." />
      <Card>
        {rows.length === 0 ? (
          <EmptyState>Nothing waiting for approval.</EmptyState>
        ) : (
          <DataTable<Product>
            caption="Products pending approval"
            rows={rows}
            rowKey={(r) => r.id}
            title={(r) => r.name}
            cols={[
              { key: "name", label: "Product", cell: (r) => <span className="font-semibold">{r.name}</span>, hideMobile: true },
              { key: "co", label: "Company", cell: (r) => r.companies?.name ?? "—" },
              { key: "bc", label: "Barcode", cell: (r) => <span className="font-mono text-[13px]">{r.barcode ?? "—"}</span> },
              { key: "cat", label: "Category", cell: (r) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><CategorySwatch category={r.category} />{CATEGORY_LABEL[r.category]}</span> },
              { key: "w", label: "Weight (g)", align: "right", cell: (r) => r.unit_weight_g },
              { key: "at", label: "Submitted", cell: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.created_at)}</span> },
              { key: "a", label: "", align: "right", cell: (r) => <ApproveButton id={r.id} name={r.name} /> },
            ]}
          />
        )}
      </Card>
    </>
  )
}
