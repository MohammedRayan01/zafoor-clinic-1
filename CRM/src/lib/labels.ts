export const bloodGroupLabels: Record<string, string> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
  UNKNOWN: "Unknown",
}

export const genderLabels: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
}

export const careCategoryLabels: Record<string, string> = {
  SKIN_HAIR_LASER: "Skin, Hair & Laser",
  DIABETOLOGY: "Diabetology",
  GENERAL_MEDICINE: "General Medicine",
}

export const patientStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
}

export const appointmentStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  IN_CONSULTATION: "In Consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
  RESCHEDULED: "Rescheduled",
}

export const appointmentStatusColors: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  CONFIRMED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  ARRIVED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  IN_CONSULTATION: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  NO_SHOW: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  RESCHEDULED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
}

export const appointmentTypeLabels: Record<string, string> = {
  IN_PERSON: "In Person",
  WALK_IN: "Walk-in",
}

export const documentCategoryLabels: Record<string, string> = {
  ID_PROOF: "ID Proof",
  INSURANCE: "Insurance",
  LAB_REPORT: "Lab Report",
  PRESCRIPTION: "Prescription",
  CONSENT_FORM: "Consent Form",
  OTHER: "Other",
}

export const commChannelLabels: Record<string, string> = {
  SMS: "SMS",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  CALL: "Call",
  SYSTEM: "System",
}

export const alertSeverityLabels: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
}

export const alertSeverityColors: Record<string, string> = {
  LOW: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

export const followUpStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  DONE: "Done",
  MISSED: "Missed",
  CANCELLED: "Cancelled",
}

export const billStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PARTIALLY_PAID: "Partially Paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
}

export const billStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  PARTIALLY_PAID: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  CANCELLED: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  REFUNDED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
}

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  NET_BANKING: "Net Banking",
  INSURANCE: "Insurance",
  ADVANCE: "Advance Balance",
}

export const refundStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
}

export const refundStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
}

export const expenseCategoryLabels: Record<string, string> = {
  UTILITIES: "Utilities",
  SUPPLIES: "Supplies",
  MAINTENANCE: "Maintenance",
  MARKETING: "Marketing",
  RENT: "Rent",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
}

// ── Staff ─────────────────────────────────────────────────────────────

export const staffRoleLabels: Record<string, string> = {
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  RECEPTIONIST: "Receptionist",
  BILLING: "Billing",
}
