"use server"

// Backs the Payments tab. Reads/writes Bill + Payment directly (via
// Supabase-JS, same as the rest of the billing system) so every bill
// created anywhere in the app shows up here, and toggling paid/unpaid here
// updates the exact same Bill row the Billing page and Finance Dashboard
// read — one source of truth instead of a separate ledger.
import { revalidatePath } from "next/cache"
import { supabase } from "@/lib/supabase"
import { requireRole } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { generateReceiptNumber } from "@/lib/sequence"

export type PatientPaymentRow = {
  id: string
  billNumber: string
  amount: number
  paymentMethod: string
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REFUNDED"
  paidAt: string | null
  createdAt: string
  patientId: string
  patientFirstName: string
  patientLastName: string | null
  patientUhid: string
  recordedByName: string | null
}

export async function getPatientPayments(): Promise<PatientPaymentRow[]> {
  const { data: bills, error } = await supabase
    .from("Bill")
    .select("id, billNumber, netAmount, status, issuedAt, patientId")
    .order("issuedAt", { ascending: false })
  if (error) throw new Error(error.message)
  if (!bills || bills.length === 0) return []

  const billIds = bills.map((b) => b.id)
  const patientIds = [...new Set(bills.map((b) => b.patientId))]

  const [{ data: patients }, { data: payments }] = await Promise.all([
    supabase.from("Patient").select("id, firstName, lastName, uhid").in("id", patientIds),
    supabase
      .from("Payment")
      .select("billId, method, paidAt, receivedById")
      .in("billId", billIds)
      .order("paidAt", { ascending: false }),
  ])

  const patientById = new Map((patients ?? []).map((p) => [p.id, p]))
  // Most recent payment per bill (list is already ordered newest-first).
  const latestPaymentByBill = new Map<string, { method: string; paidAt: string; receivedById: string | null }>()
  for (const p of payments ?? []) {
    if (!p.billId || latestPaymentByBill.has(p.billId)) continue
    latestPaymentByBill.set(p.billId, p)
  }

  const userIds = [...new Set([...latestPaymentByBill.values()].map((p) => p.receivedById).filter(Boolean))]
  const { data: users } = userIds.length
    ? await supabase.from("User").select("id, name").in("id", userIds)
    : { data: [] as { id: string; name: string }[] }
  const userById = new Map((users ?? []).map((u) => [u.id, u]))

  return bills.map((b) => {
    const patient = patientById.get(b.patientId)
    const payment = latestPaymentByBill.get(b.id)
    return {
      id: b.id,
      billNumber: b.billNumber,
      amount: Number(b.netAmount),
      paymentMethod: payment?.method ?? "—",
      status: b.status,
      paidAt: payment?.paidAt ?? null,
      createdAt: b.issuedAt,
      patientId: b.patientId,
      patientFirstName: patient?.firstName ?? "Unknown",
      patientLastName: patient?.lastName ?? null,
      patientUhid: patient?.uhid ?? "—",
      recordedByName: payment?.receivedById ? (userById.get(payment.receivedById)?.name ?? null) : null,
    }
  })
}

export async function setPatientPaymentStatus(billId: string, status: "PAID" | "PENDING") {
  const user = await requireRole("ADMIN", "BILLING", "RECEPTIONIST")

  const { data: bill, error: fetchError } = await supabase
    .from("Bill")
    .select("id, patientId, netAmount, amountPaid, status")
    .eq("id", billId)
    .maybeSingle()
  if (fetchError) throw new Error(fetchError.message)
  if (!bill) throw new Error("Bill not found")
  if (bill.status === "CANCELLED" || bill.status === "REFUNDED") {
    throw new Error("This bill is cancelled or refunded and can't be toggled here.")
  }
  if (bill.status === status) return

  const netAmount = Number(bill.netAmount)

  if (status === "PAID") {
    const remaining = netAmount - Number(bill.amountPaid)
    if (remaining > 0.01) {
      const receiptNumber = await generateReceiptNumber()
      const { error: paymentError } = await supabase.from("Payment").insert({
        receiptNumber,
        patientId: bill.patientId,
        billId: bill.id,
        amount: remaining,
        method: "CASH",
        status: "SUCCESS",
        receivedById: user.id,
        paidAt: new Date().toISOString(),
      })
      if (paymentError) throw new Error(paymentError.message)
    }
    const { error } = await supabase
      .from("Bill")
      .update({ status: "PAID", amountPaid: netAmount, balanceDue: 0 })
      .eq("id", billId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from("Bill")
      .update({ status: "PENDING", amountPaid: 0, balanceDue: netAmount })
      .eq("id", billId)
    if (error) throw new Error(error.message)
  }

  await logAudit({
    action: "PAYMENT_RECORDED",
    entityType: "Bill",
    entityId: billId,
    metadata: { netAmount, patientId: bill.patientId, status },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/payments")
  revalidatePath("/billing")
  revalidatePath(`/billing/${billId}`)
  revalidatePath(`/patients/${bill.patientId}`)
  revalidatePath("/finance/dashboard")
}
