"use server"

// Reads/writes the legacy "PatientPayment" table directly — it predates this
// codebase's Bill/Payment model (see prisma/migrate-legacy-payments.ts) and
// was intentionally left in place rather than dropped, since it may still be
// the table a separate, older deployment of this CRM writes to. `@/lib/prisma`
// is not a real Prisma client at runtime (see src/lib/supabase-db.ts) — it's a
// Supabase-JS wrapper with no raw-SQL passthrough and no model for this
// legacy table, so this goes straight through Supabase-JS instead.
import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

export type PatientPaymentRow = {
  id: string
  amount: number
  paymentMethod: string
  status: "PENDING" | "PAID"
  paidAt: string | null
  createdAt: string
  patientId: string
  patientFirstName: string
  patientLastName: string | null
  patientUhid: string
  recordedByName: string | null
}

export async function getPatientPayments(): Promise<PatientPaymentRow[]> {
  const { data: payments, error } = await supabase
    .from("PatientPayment")
    .select("id, amount, paymentMethod, status, paidAt, createdAt, patientId, recordedById")
    .order("createdAt", { ascending: false })
  if (error) throw new Error(error.message)
  if (!payments || payments.length === 0) return []

  const patientIds = [...new Set(payments.map((p) => p.patientId))]
  const userIds = [...new Set(payments.map((p) => p.recordedById).filter(Boolean))]

  const [{ data: patients }, { data: users }] = await Promise.all([
    supabase.from("Patient").select("id, firstName, lastName, uhid").in("id", patientIds),
    userIds.length ? supabase.from("User").select("id, name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  const userById = new Map((users ?? []).map((u) => [u.id, u]))

  return payments.map((p) => {
    const patient = patientById.get(p.patientId)
    return {
      id: p.id,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      status: p.status,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      patientId: p.patientId,
      patientFirstName: patient?.firstName ?? "Unknown",
      patientLastName: patient?.lastName ?? null,
      patientUhid: patient?.uhid ?? "—",
      recordedByName: p.recordedById ? (userById.get(p.recordedById)?.name ?? null) : null,
    }
  })
}

export async function markPatientPaymentPaid(id: string) {
  const user = await requireRole("ADMIN", "BILLING", "RECEPTIONIST")

  const { data: existing, error: fetchError } = await supabase
    .from("PatientPayment")
    .select("id, patientId, amount, status")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("Payment not found")
  if (existing.status === "PAID") return

  const { error } = await supabase
    .from("PatientPayment")
    .update({ status: "PAID", paidAt: new Date().toISOString(), verifiedById: user.id, updatedAt: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(error.message)

  await logAudit({
    action: "PAYMENT_RECORDED",
    entityType: "Payment",
    entityId: id,
    metadata: { amount: Number(existing.amount), patientId: existing.patientId },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/payments")
}
