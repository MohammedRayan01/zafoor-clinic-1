"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { generateReceiptNumber } from "@/lib/sequence"
import { toPlain } from "@/lib/serialize"
import { logAudit } from "@/lib/audit"
import { collectPaymentSchema, refundSchema, type CollectPaymentInput, type RefundInput } from "@/lib/validations/billing"

function nextBillStatus(netAmount: number, amountPaid: number): "PENDING" | "PARTIALLY_PAID" | "PAID" {
  if (amountPaid <= 0) return "PENDING"
  if (amountPaid >= netAmount - 0.01) return "PAID"
  return "PARTIALLY_PAID"
}

export async function collectPayment(billId: string, patientId: string, input: CollectPaymentInput) {
  const data = collectPaymentSchema.parse(input)
  const user = await requireRole("ADMIN", "BILLING", "RECEPTIONIST")

  const bill = await prisma.bill.findUniqueOrThrow({
    where: { id: billId },
    include: { items: true },
  })

  if (bill.status === "PAID") {
    throw new Error("This bill is already fully paid and finalized.")
  }

  const balanceDue = Number(bill.balanceDue)
  if (data.amount > balanceDue + 0.01) {
    throw new Error(`Amount exceeds outstanding balance of ₹${balanceDue.toFixed(2)}`)
  }

  const paymentResult = await prisma.$transaction(async (tx) => {
    // 1. Advance payment deduction
    if (data.method === "ADVANCE") {
      let remaining = data.amount
      const advances = await tx.patientAdvance.findMany({
        where: { patientId, balance: { gt: 0 } },
        orderBy: { paidAt: "asc" },
      })
      const totalAvailable = advances.reduce((sum, a) => sum + Number(a.balance), 0)
      if (totalAvailable < data.amount - 0.01) {
        throw new Error(`Insufficient advance balance (available ₹${totalAvailable.toFixed(2)})`)
      }
      for (const advance of advances) {
        if (remaining <= 0) break
        const use = Math.min(Number(advance.balance), remaining)
        await tx.patientAdvance.update({ where: { id: advance.id }, data: { balance: { decrement: use } } })
        await tx.advanceAdjustment.create({ data: { advanceId: advance.id, billId, amount: use } })
        remaining -= use
      }
    }

    // 2. Cash session hook
    let cashSessionId: string | null = null
    if (data.method === "CASH") {
      const session = await tx.cashSession.findFirst({ where: { status: "OPEN" }, orderBy: { openedAt: "desc" } })
      cashSessionId = session?.id ?? null
    }

    // 3. Create payment record
    const receiptNumber = await generateReceiptNumber(tx)
    const payment = await tx.payment.create({
      data: {
        receiptNumber,
        patientId,
        billId,
        amount: data.amount,
        method: data.method,
        status: "SUCCESS",
        referenceNumber: data.referenceNumber || null,
        cashSessionId,
        receivedById: user.id,
      },
    })

    const newAmountPaid = Number(bill.amountPaid) + data.amount
    const newBalanceDue = Math.max(Number(bill.netAmount) - newAmountPaid, 0)
    const newStatus = nextBillStatus(Number(bill.netAmount), newAmountPaid)

    await tx.bill.update({
      where: { id: billId },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
      },
    })

    // 4. ATOMIC INVENTORY DEDUCTION ON BILL FINALIZATION / PAYMENT
    // When payment is recorded, any medicines on this bill that haven't been dispensed yet are atomically deducted
    for (const billItem of bill.items) {
      const invItem = await tx.inventoryItem.findFirst({
        where: {
          active: true,
          OR: [
            { name: { equals: billItem.description, mode: "insensitive" } },
            { sku: { equals: billItem.description, mode: "insensitive" } },
          ],
        },
      })

      if (invItem) {
        // Check if already dispensed for this bill to prevent double deduction
        const alreadyDispensed = await tx.inventoryTransaction.findFirst({
          where: {
            itemId: invItem.id,
            patientId,
            reason: { contains: bill.billNumber },
          },
        })

        if (!alreadyDispensed) {
          if (invItem.currentStock < billItem.quantity) {
            throw new Error(`Cannot finalize billing: Insufficient stock for ${invItem.name}. Required: ${billItem.quantity}, Available: ${invItem.currentStock}`)
          }

          const previousStock = invItem.currentStock
          const newStock = previousStock - billItem.quantity

          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: newStock },
          })

          await tx.inventoryTransaction.create({
            data: {
              itemId: invItem.id,
              type: "STOCK_OUT",
              quantity: billItem.quantity,
              previousStock,
              newStock,
              reason: `Bill #${bill.billNumber} Dispense`,
              patientId,
              performedById: user.id,
            },
          })

          // Low-Stock Threshold Evaluation (20% threshold)
          if (newStock <= invItem.lowStockThresholdQty) {
            const existingAlert = await tx.inventoryAlert.findFirst({
              where: {
                itemId: invItem.id,
                status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
              },
            })

            if (existingAlert) {
              await tx.inventoryAlert.update({
                where: { id: existingAlert.id },
                data: {
                  currentQuantity: newStock,
                  updatedAt: new Date(),
                  severity: newStock === 0 ? "CRITICAL" : "HIGH",
                },
              })
            } else {
              await tx.inventoryAlert.create({
                data: {
                  itemId: invItem.id,
                  alertType: "LOW_STOCK",
                  severity: newStock === 0 ? "CRITICAL" : "HIGH",
                  currentQuantity: newStock,
                  thresholdQuantity: invItem.lowStockThresholdQty,
                  status: "ACTIVE",
                },
              })
            }
          }
        }
      }
    }

    // 5. Audit Logging
    await logAudit({
      action: "PAYMENT_RECORDED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        receiptNumber: payment.receiptNumber,
        billNumber: bill.billNumber,
        patientId,
        amount: data.amount,
        method: data.method,
        remainingBalance: newBalanceDue,
        billStatus: newStatus,
      },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    if (newStatus === "PAID") {
      await logAudit({
        action: "BILL_FINALIZED",
        entityType: "Bill",
        entityId: bill.id,
        metadata: {
          billNumber: bill.billNumber,
          patientId,
          totalAmount: Number(bill.totalAmount),
          netAmount: Number(bill.netAmount),
          amountPaid: newAmountPaid,
        },
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        tx,
      })
    }

    return payment
  })

  revalidatePath(`/billing/${billId}`)
  revalidatePath("/billing")
  revalidatePath(`/patients/${patientId}`)
  revalidatePath("/finance/cash-counter")
  revalidatePath("/inventory")
  revalidatePath("/inventory/alerts")
  return toPlain(paymentResult)
}

export async function getPayments(params: { patientId?: string; cashSessionId?: string; page?: number; pageSize?: number }) {
  const { patientId, cashSessionId, page = 1, pageSize = 30 } = params
  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (cashSessionId) where.cashSessionId = cashSessionId

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { patient: true, bill: true, receivedBy: true },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ])

  return { payments: toPlain(payments), total, page, pageSize }
}

export async function getReceipt(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { patient: true, bill: { include: { items: true } }, receivedBy: true },
  })
  if (!payment) return null
  return toPlain(payment)
}

// ── Advances ────────────────────────────────────────────────────────────

export async function addAdvance(patientId: string, input: { amount: number; method: string; referenceNumber?: string; notes?: string }) {
  const user = await requireRole("ADMIN", "BILLING", "RECEPTIONIST")
  const advance = await prisma.patientAdvance.create({
    data: {
      patientId,
      amount: input.amount,
      balance: input.amount,
      method: input.method as never,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      receivedById: user.id,
    },
  })
  revalidatePath(`/patients/${patientId}`)
  revalidatePath("/billing")
  return toPlain(advance)
}

export async function getPatientAdvanceBalance(patientId: string) {
  const advances = await prisma.patientAdvance.findMany({ where: { patientId, balance: { gt: 0 } } })
  return advances.reduce((sum, a) => sum + Number(a.balance), 0)
}

// ── Refunds & Stock Return ──────────────────────────────────────────────

export async function requestRefund(patientId: string, input: RefundInput, billId?: string, paymentId?: string) {
  const data = refundSchema.parse(input)
  const refund = await prisma.refund.create({
    data: { patientId, billId, paymentId, amount: data.amount, reason: data.reason, method: data.method },
  })
  revalidatePath(`/patients/${patientId}`)
  revalidatePath("/billing/refunds")
  if (billId) revalidatePath(`/billing/${billId}`)
  return toPlain(refund)
}

export async function processRefund(id: string, decision: "COMPLETE" | "REJECT") {
  const user = await requireRole("ADMIN", "BILLING")
  const refund = await prisma.refund.findUniqueOrThrow({ where: { id } })

  if (decision === "REJECT") {
    await prisma.refund.update({
      where: { id },
      data: { status: "REJECTED", processedAt: new Date(), processedById: user.id },
    })
    revalidatePath("/billing/refunds")
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id },
      data: { status: "COMPLETED", processedAt: new Date(), processedById: user.id },
    })

    if (refund.billId) {
      const bill = await tx.bill.findUniqueOrThrow({
        where: { id: refund.billId },
        include: { items: true },
      })
      const newAmountPaid = Math.max(Number(bill.amountPaid) - Number(refund.amount), 0)
      const newBalanceDue = Number(bill.netAmount) - newAmountPaid
      await tx.bill.update({
        where: { id: refund.billId },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: Math.max(newBalanceDue, 0),
          status: newAmountPaid <= 0 ? "REFUNDED" : nextBillStatus(Number(bill.netAmount), newAmountPaid),
        },
      })

      // Explicit STOCK_RETURN if medicines were dispensed on this refunded bill
      for (const item of bill.items) {
        const invItem = await tx.inventoryItem.findFirst({
          where: {
            active: true,
            OR: [
              { name: { equals: item.description, mode: "insensitive" } },
              { sku: { equals: item.description, mode: "insensitive" } },
            ],
          },
        })

        if (invItem) {
          const previousStock = invItem.currentStock
          const newStock = previousStock + item.quantity

          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { currentStock: newStock },
          })

          await tx.inventoryTransaction.create({
            data: {
              itemId: invItem.id,
              type: "RETURN",
              quantity: item.quantity,
              previousStock,
              newStock,
              reason: `Refund on Bill #${bill.billNumber}`,
              patientId: refund.patientId,
              performedById: user.id,
            },
          })

          // Auto-resolve low-stock alert if restocked above threshold
          if (newStock > invItem.lowStockThresholdQty) {
            await tx.inventoryAlert.updateMany({
              where: {
                itemId: invItem.id,
                status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
              },
              data: {
                status: "RESOLVED",
                resolvedAt: new Date(),
                resolvedById: user.id,
                notes: "Auto-resolved after refund stock return",
              },
            })
          }
        }
      }

      await logAudit({
        action: "REFUND_CREATED",
        entityType: "Refund",
        entityId: refund.id,
        metadata: {
          billNumber: bill.billNumber,
          patientId: refund.patientId,
          amount: Number(refund.amount),
          reason: refund.reason,
        },
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        tx,
      })
    }
  })

  revalidatePath("/billing/refunds")
  if (refund.billId) revalidatePath(`/billing/${refund.billId}`)
  revalidatePath(`/patients/${refund.patientId}`)
  revalidatePath("/inventory")
  revalidatePath("/inventory/alerts")
}

export async function getRefunds(status?: string) {
  const refunds = await prisma.refund.findMany({
    where: status ? { status: status as never } : undefined,
    include: { patient: true, bill: true },
    orderBy: { requestedAt: "desc" },
  })
  return toPlain(refunds)
}
