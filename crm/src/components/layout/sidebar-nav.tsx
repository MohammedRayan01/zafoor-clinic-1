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
} from "lucide-react"
import { cn } from "@/lib/utils"

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
      { href: "/inventory", label: "Inventory", icon: Boxes },
      { href: "/waiting-list", label: "Waiting List", icon: Clock },
      { href: "/follow-ups", label: "Follow-ups", icon: CheckSquare },
      { href: "/communications", label: "Communications", icon: MessageSquare },
    ],
  },
  {
    label: "Clinical",
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    items: [
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

export function SidebarNav({ role = "ADMIN" }: { role?: string }) {
  const pathname = usePathname()
  const isAdmin = role === "ADMIN"

  const visibleGroups = navGroups
    .filter((group) => !group.adminOnly || isAdmin)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-background">
      <div className="flex items-center gap-2 px-5 h-16 border-b shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Zafoor Clinic</p>
          <p className="text-xs text-muted-foreground">{role === "ADMIN" ? "Admin CRM" : "Reception Desk"}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className={cn("flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide", group.text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", group.dot)} />
              {group.label}
            </p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/appointments" && pathname.startsWith("/appointments/")) ||
                (item.href === "/inventory" && pathname.startsWith("/inventory/")) ||
                (item.href === "/billing" && pathname.startsWith("/billing/") && !pathname.startsWith("/billing/refunds")) ||
                (!["/appointments", "/billing", "/inventory"].includes(item.href) && item.href.length > 1 && pathname.startsWith(`${item.href}/`))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", !isActive && group.text)} />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
