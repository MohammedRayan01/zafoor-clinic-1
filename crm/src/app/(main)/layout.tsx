import { redirect } from "next/navigation"
import { getCurrentUserOrNull } from "@/lib/auth"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { Header } from "@/components/layout/header"

export const dynamic = "force-dynamic"

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserOrNull()
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex flex-1 min-h-screen">
      <SidebarNav role={user.role} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header user={{ name: user.name, role: user.role }} />
        <main className="flex-1 min-w-0 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
