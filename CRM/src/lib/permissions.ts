import type { StaffRole } from "@/types/database"

export type TabItemDefinition = {
  id: string
  href: string
  label: string
  group: "Care" | "Clinical" | "Billing & Finance" | "Website" | "Calendar"
  description: string
}

export const ALL_AVAILABLE_TABS: TabItemDefinition[] = [
  // Care
  { id: "dashboard", href: "/dashboard", label: "Dashboard", group: "Care", description: "Clinical overview, today's appointments, quick stats" },
  { id: "patients", href: "/patients", label: "Patients", group: "Care", description: "Patient directory, registration, health profiles" },
  { id: "appointments", href: "/appointments", label: "Appointments", group: "Care", description: "Appointment scheduling and daily slot board" },
  { id: "queue", href: "/queue", label: "Today's Queue", group: "Care", description: "Live waiting room, token calling, check-ins" },
  { id: "inventory", href: "/inventory", label: "Medicine & Stock", group: "Care", description: "Medicine dispensing, stock returns, stock alerts" },
  { id: "waiting_list", href: "/waiting-list", label: "Waiting List", group: "Care", description: "Standby patient queue for early openings" },
  { id: "follow_ups", href: "/follow-ups", label: "Follow-ups", group: "Care", description: "Post-consultation follow-up scheduling" },
  { id: "communications", href: "/communications", label: "Communications", group: "Care", description: "Patient SMS, WhatsApp, and call logs" },

  // Clinical
  { id: "doctor_availability", href: "/appointments/availability", label: "Doctor Availability", group: "Clinical", description: "Doctor shift timings and off-duty calendar" },
  { id: "doctor_templates", href: "/templates", label: "Doctor Templates", group: "Clinical", description: "SOAP note presets, Rx prescription templates" },
  { id: "digital_signature", href: "/settings/signature", label: "Digital Signature", group: "Clinical", description: "Doctor signature for prescriptions and EMR" },
  { id: "audit_logs", href: "/audit-logs", label: "Audit Logs", group: "Clinical", description: "System security and staff activity logs" },

  // Billing & Finance
  { id: "payments", href: "/payments", label: "Payments", group: "Billing & Finance", description: "Patient payment ledger — mark pending payments as paid" },
  { id: "billing", href: "/billing", label: "Billing & Invoices", group: "Billing & Finance", description: "Create invoices, record payments, print receipts" },
  { id: "refunds", href: "/billing/refunds", label: "Refunds", group: "Billing & Finance", description: "Patient refund authorizations and ledger" },
  { id: "finance_dashboard", href: "/finance/dashboard", label: "Finance Dashboard", group: "Billing & Finance", description: "Revenue KPIs, payment method splits, P&L" },
  { id: "outstanding_dues", href: "/finance/outstanding", label: "Outstanding Dues", group: "Billing & Finance", description: "Unpaid bills and credit patient balances" },
  { id: "cash_counter", href: "/finance/cash-counter", label: "Cash Counter", group: "Billing & Finance", description: "Physical cash drawer opening/closing sessions" },
  { id: "expenses", href: "/finance/expenses", label: "Expenses", group: "Billing & Finance", description: "Clinic petty cash and vendor expense logging" },
  { id: "reports", href: "/finance/reports", label: "Financial Reports", group: "Billing & Finance", description: "Audited revenue statements and tax breakdowns" },
  { id: "services", href: "/services", label: "Services Catalog", group: "Billing & Finance", description: "Consultation and procedure tariff master" },

  // Website
  { id: "website_content", href: "/website/content", label: "Website Content", group: "Website", description: "Homepage banners, clinic timing, doctors list" },
  { id: "website_reviews", href: "/website/reviews", label: "Patient Reviews", group: "Website", description: "Moderate testimonials published on website" },
  { id: "website_faqs", href: "/website/faqs", label: "Website FAQs", group: "Website", description: "Publish answers to common patient questions" },

  // Calendar
  { id: "calendar", href: "/calendar", label: "Master Calendar", group: "Calendar", description: "Multi-doctor unified calendar view" },
]

export type ActionScopeDefinition = {
  key: string
  label: string
  category: "Appointments" | "Medicines & Inventory" | "Billing & Cash" | "Patient Data & Exports"
  description: string
}

export const ALL_ACTION_SCOPES: ActionScopeDefinition[] = [
  {
    key: "canBookAppointments",
    label: "Schedule Appointments & Issue Tokens",
    category: "Appointments",
    description: "Book new appointments and issue walk-in queue tokens",
  },
  {
    key: "canEditAppointments",
    label: "Edit / Reschedule Appointments",
    category: "Appointments",
    description: "Change appointment time, doctor, or reschedule existing bookings",
  },
  {
    key: "canCancelAppointments",
    label: "Cancel Existing Appointments",
    category: "Appointments",
    description: "Cancel confirmed or scheduled appointments",
  },
  {
    key: "canDispenseMedicine",
    label: "Dispense / Sell Medicines",
    category: "Medicines & Inventory",
    description: "Log medicine counter sales and deduct stock units",
  },
  {
    key: "canReturnMedicine",
    label: "Record Medicine Returns",
    category: "Medicines & Inventory",
    description: "Accept patient medicine returns and restock inventory",
  },
  {
    key: "canManageMedicineCatalog",
    label: "Add / Edit Medicine Catalog & Pricing",
    category: "Medicines & Inventory",
    description: "Create new medicines, adjust retail prices, archive items",
  },
  {
    key: "canCollectPayment",
    label: "Collect Payments (Cash / UPI / Card)",
    category: "Billing & Cash",
    description: "Collect patient payments and issue official receipts",
  },
  {
    key: "canProcessRefunds",
    label: "Process Refunds",
    category: "Billing & Cash",
    description: "Authorize and disburse patient payment refunds",
  },
  {
    key: "canViewFinancialReports",
    label: "View Revenue & Financial Analytics",
    category: "Billing & Cash",
    description: "Access finance dashboard, profit & loss, and cash reports",
  },
  {
    key: "canExportData",
    label: "Export Patient / Billing Data (CSV / PDF)",
    category: "Patient Data & Exports",
    description: "Download patient lists, billing registers, or reports",
  },
]

export type StaffPermissions = {
  allowedTabs: string[] // List of allowed hrefs (e.g. ["/dashboard", "/patients", ...])
  actionScopes: Record<string, boolean>
}

// ── Default Role Presets ──────────────────────────────────────────────────

export const DEFAULT_ADMIN_PERMISSIONS: StaffPermissions = {
  allowedTabs: ALL_AVAILABLE_TABS.map((t) => t.href),
  actionScopes: ALL_ACTION_SCOPES.reduce((acc, s) => {
    acc[s.key] = true
    return acc
  }, {} as Record<string, boolean>),
}

export const DEFAULT_DOCTOR_PERMISSIONS: StaffPermissions = {
  allowedTabs: [
    "/dashboard",
    "/patients",
    "/appointments",
    "/queue",
    "/calendar",
    "/templates",
    "/settings/signature",
  ],
  actionScopes: {
    canBookAppointments: true,
    canEditAppointments: true,
    canCancelAppointments: true,
    canDispenseMedicine: true,
    canReturnMedicine: false,
    canManageMedicineCatalog: false,
    canCollectPayment: false,
    canProcessRefunds: false,
    canViewFinancialReports: false,
    canExportData: false,
  },
}

export const DEFAULT_RECEPTIONIST_PERMISSIONS: StaffPermissions = {
  allowedTabs: [
    "/dashboard",
    "/patients",
    "/appointments",
    "/queue",
    "/inventory",
    "/waiting-list",
    "/follow-ups",
    "/communications",
    "/calendar",
  ],
  actionScopes: {
    canBookAppointments: true,
    canEditAppointments: false, // Admin only by default
    canCancelAppointments: false, // Admin only by default
    canDispenseMedicine: true,
    canReturnMedicine: true,
    canManageMedicineCatalog: false, // Admin only
    canCollectPayment: true,
    canProcessRefunds: false, // Admin only
    canViewFinancialReports: false, // Admin only
    canExportData: false,
  },
}

/**
 * Returns the effective permissions for a user, falling back to role defaults if not customized.
 */
export function getEffectivePermissions(user: { role: StaffRole; permissions?: any }): StaffPermissions {
  if (user.role === "ADMIN") {
    // Admin always has full access
    return DEFAULT_ADMIN_PERMISSIONS
  }

  const roleDefault = user.role === "DOCTOR" ? DEFAULT_DOCTOR_PERMISSIONS : DEFAULT_RECEPTIONIST_PERMISSIONS

  if (!user.permissions || typeof user.permissions !== "object") {
    return roleDefault
  }

  const custom = user.permissions as Partial<StaffPermissions>

  return {
    allowedTabs: Array.isArray(custom.allowedTabs) ? custom.allowedTabs : roleDefault.allowedTabs,
    actionScopes: {
      ...roleDefault.actionScopes,
      ...(custom.actionScopes || {}),
    },
  }
}

/**
 * Checks if a user has access to a specific route/tab.
 */
export function hasTabAccess(user: { role: StaffRole; permissions?: any }, href: string): boolean {
  if (user.role === "ADMIN") return true
  const effective = getEffectivePermissions(user)
  // Match prefix or exact
  return effective.allowedTabs.some((tab) => href === tab || href.startsWith(`${tab}/`))
}

/**
 * Checks if a user has permission to perform a specific action scope.
 */
export function hasActionScope(user: { role: StaffRole; permissions?: any }, scopeKey: string): boolean {
  if (user.role === "ADMIN") return true
  const effective = getEffectivePermissions(user)
  return !!effective.actionScopes[scopeKey]
}
