import Link from "next/link"
import type { Metadata } from "next"
import { Card, CardHead, KV, PageHeader } from "@/components/vb/ui"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/actions"
import { href, pageCtx } from "@/lib/session"
import { ROLE_LABEL } from "@/lib/shared"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, sp, companies } = await pageCtx(searchParams)
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHead eyebrow="Profile" title={user.name} />
          <KV
            items={[
              ["Email", user.email],
              ["Role", ROLE_LABEL[user.role]],
              ["Company", user.role === "regulator" || user.role === "admin" ? "All companies" : companies.map((c) => c.name).join(", ") || "None assigned"],
            ]}
          />
          <p className="mt-4 text-sm text-olive-700">Profile details are managed by your admin.</p>
          <form action={logout} className="mt-6">
            <Button variant="secondary" type="submit">Sign out</Button>
          </form>
        </Card>
        {user.role === "admin" && (
          <Card className="lg:col-span-5">
            <CardHead eyebrow="Admin" title="Users" />
            <p className="mb-4 text-sm text-olive-700">Public sign-up is off. Invite producers, auditors and regulators here.</p>
            <Button asChild><Link href={href("/app/settings/users", sp)}>Manage users</Link></Button>
          </Card>
        )}
      </div>
    </>
  )
}
