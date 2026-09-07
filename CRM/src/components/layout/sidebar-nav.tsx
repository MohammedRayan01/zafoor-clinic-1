"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ListOrdered,
  Clock,
  CheckSquare,
  MessageSquare,
  CalendarClock,
  Stethoscope,
  FileEdit,
  PenTool,
  Receipt,
  Undo2,
  TrendingUp,
  AlertCircle,
  Wallet,
  BarChart3,
  Package,
  CalendarCheck2,
  Globe,
  MessagesSquare,
  HelpCircle,
  Boxes,
  ShieldAlert,
  IndianRupee,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { hasTabAccess } from "@/lib/permissions"
import type { StaffRole } from "@/types/database"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  dot: string
  text: string
  adminOnly?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Care",
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/appointments", label: "Appointments", icon: CalendarDays },
      { href: "/queue", label: "Queue", icon: ListOrdered },
      { href: "/inventory", label: "Medicine & Stock", icon: Boxes },
      { href: "/waiting-list", label: "Waiting List", icon: Clock },
      { href: "/follow-ups", label: "Follow-ups", icon: CheckSquare },
      { href: "/communications", label: "Communications", icon: MessageSquare },
      { href: "/communications/whatsapp", label: "WhatsApp Bulk Messaging", icon: MessagesSquare },
    ],
  },
  {
    label: "Clinical & Staff",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    items: [
      { href: "/settings/staff", label: "Staff & Logins", icon: Users, adminOnly: true },
      { href: "/appointments/availability", label: "Doctor Availability", icon: CalendarClock },
      { href: "/templates", label: "Doctor Templates", icon: FileEdit },
      { href: "/settings/signature", label: "Digital Signature", icon: PenTool },
      { href: "/audit-logs", label: "Audit Logs", icon: ShieldAlert, adminOnly: true },
    ],
  },
  {
    label: "Billing & Finance",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    items: [
      { href: "/payments", label: "Payments", icon: IndianRupee },
      { href: "/billing", label: "Billing", icon: Receipt },
      { href: "/billing/refunds", label: "Refunds", icon: Undo2 },
      { href: "/finance/dashboard", label: "Finance Dashboard", icon: TrendingUp },
      { href: "/finance/outstanding", label: "Outstanding Dues", icon: AlertCircle },
      { href: "/finance/cash-counter", label: "Cash Counter", icon: Wallet },
      { href: "/finance/expenses", label: "Expenses", icon: Receipt },
      { href: "/finance/reports", label: "Reports", icon: BarChart3 },
      { href: "/services", label: "Services", icon: Package },
    ],
  },
  {
    label: "Website",
    dot: "bg-pink-500",
    text: "text-pink-600 dark:text-pink-400",
    adminOnly: true,
    items: [
      { href: "/website/content", label: "Site Content", icon: Globe },
      { href: "/website/reviews", label: "Reviews", icon: MessagesSquare },
      { href: "/website/faqs", label: "FAQs", icon: HelpCircle },
    ],
  },
  {
    label: "Calendar",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    items: [{ href: "/calendar", label: "Calendar", icon: CalendarCheck2 }],
  },
]

export function NavContent({
  role = "ADMIN",
  permissions,
  onNavigate,
}: {
  role?: string
  permissions?: any
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isAdmin = role === "ADMIN"
  const userContext = { role: role as StaffRole, permissions }

  const visibleGroups = navGroups
    .filter((group) => !group.adminOnly || isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !isAdmin) return false
        return hasTabAccess(userContext, item.href)
      }),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">Zafoor Clinic</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? "Admin CRM" : "Reception Desk"}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", group.dot)} />
              <span className={cn("text-[11px] font-bold tracking-wider", group.text)}>{group.label}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

export function SidebarNav({
  role = "ADMIN",
  permissions,
}: {
  role?: string
  permissions?: any
}) {
  return (
    <aside className="hidden lg:flex w-64 flex-col border-r bg-card shrink-0 min-h-screen">
      <NavContent role={role} permissions={permissions} />
    </aside>
  )
}
