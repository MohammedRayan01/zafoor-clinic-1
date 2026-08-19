import { prisma } from "@/lib/prisma"
import { getCurrentUserOrNull } from "@/lib/auth"
import type { Prisma } from "@/generated/prisma/client"

export type AuditAction =
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "PATIENT_LOCKED"
  | "PATIENT_OVERRIDE"
  | "PATIENT_DELETED"
  | "APPOINTMENT_BOOKED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_STATUS_CHANGED"
  | "STOCK_IN"
  | "STOCK_OUT"
  | "STOCK_ADJUSTMENT"
  | "STOCK_RETURN"
  | "MEDICINE_CREATED"
  | "MEDICINE_UPDATED"
  | "MEDICINE_ARCHIVED"
  | "ALERT_CREATED"
  | "ALERT_UPDATED"
  | "ALERT_ACKNOWLEDGED"
  | "ALERT_RESOLVED"
  | "BILL_CREATED"
  | "BILL_FINALIZED"
  | "BILL_CANCELLED"
  | "PAYMENT_RECORDED"
  | "INVOICE_GENERATED"
  | "RECEIPT_GENERATED"
  | "REFUND_CREATED"
  | "USER_LOGIN"
  | "PERMISSION_OVERRIDE"

interface LogAuditParams {
  action: AuditAction
  entityType: "Patient" | "Appointment" | "InventoryItem" | "InventoryAlert" | "Bill" | "Payment" | "Refund" | "User" | "System"
  entityId?: string
  metadata?: Record<string, unknown> | null
  userId?: string
  userName?: string
  userRole?: string
  ipAddress?: string
  tx?: Prisma.TransactionClient
}

export async function logAudit(params: LogAuditParams) {
  try {
    const client = params.tx || prisma
    let userId = params.userId
    let userName = params.userName
    let userRole = params.userRole

    if (!userId) {
      const currentUser = await getCurrentUserOrNull()
      if (currentUser) {
        userId = currentUser.id
        userName = currentUser.name
        userRole = currentUser.role
      }
    }

    return await client.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        userId: userId || null,
        userName: userName || "System",
        userRole: userRole || "SYSTEM",
        ipAddress: params.ipAddress || null,
      },
    })
  } catch (err) {
    console.error("[AuditLog] Failed to record audit entry:", err)
    return null
  }
}
