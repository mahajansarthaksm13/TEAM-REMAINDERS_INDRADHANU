import { Sidebar, TopBar, type AlertItem } from "@/components/vb/shell"
import { openAlerts } from "@/lib/data"
import { requireSession, scopeOptions } from "@/lib/session"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { sb, user, companies } = await requireSession()
  // Bell shows every open alert the user may see (RLS). Companies and admins may close them (A12).
  const canClose = user.role === "company" || user.role === "admin"
  const alerts: AlertItem[] = (await openAlerts(sb, null)).map((a) => ({
    id: a.id,
    type: a.kind,
    message: a.message,
    created_at: a.opened_at,
    href: a.kind === "target_at_risk" || !a.bin_id ? "/app/targets" : `/app/bins/${a.bin_id}`,
    canClose: canClose && (user.role === "admin" || a.company_id === user.company_id),
  }))
  const own = companies.find((c) => c.id === user.company_id)
  return (
    <div className="min-h-dvh">
      <Sidebar role={user.role} />
      <div className="lg:pl-[248px]">
        <TopBar
          user={{ name: user.name, email: user.email, role: user.role }}
          scope={{ options: scopeOptions(user, companies), staticName: user.role === "company" ? own?.name ?? "Your company" : undefined }}
          alerts={alerts}
        />
        {/* stagger: each block on a page rises in after the one before it */}
        <main id="main" className="stagger mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
