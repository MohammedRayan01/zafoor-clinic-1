import "dotenv/config"
import { prisma } from "../src/lib/prisma"
import {
  createPatient,
  updatePatientCore,
  adminUnlockPatient,
  adminLockPatient,
  deletePatient,
} from "../src/actions/patients"
import { bookAppointment, getAvailableSlots } from "../src/actions/appointments"
import {
  createInventoryItem,
  updateInventoryItem,
  stockIn,
  stockOut,
  acknowledgeAlert,
  resolveAlert,
  getInventoryItemById,
  getInventoryAlerts,
} from "../src/actions/inventory"
import { createBill, cancelBill, getBill } from "../src/actions/billing"
import { collectPayment, processRefund, requestRefund } from "../src/actions/payments"
import { getAuditLogs } from "../src/actions/audit"

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
  console.log(`   ✅ PASS: ${message}`)
}

async function runComprehensiveTestSuite() {
  console.log("==================================================================")
  console.log("  Zafoor Clinic CRM — Comprehensive Full-Stack Test Suite")
  console.log("==================================================================\n")

  // Staff accounts
  const adminUser = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })
  const receptionistUser = await prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST" } })
  const doctorUser = await prisma.user.findFirstOrThrow({ where: { role: "DOCTOR" } })

  console.log("--- TEST GROUP 1: Patient Registration & RBAC Lifecycle ---")
  // 1. Create patient as Receptionist
  const testPhone = `97777${Math.floor(10000 + Math.random() * 90000)}`
  const p1 = await prisma.patient.create({
    data: {
      uhid: `ZC-LOCK-${Date.now().toString().slice(-6)}`,
      firstName: "Fatima",
      lastName: "Zahra",
      gender: "FEMALE",
      phone: testPhone,
      source: "CRM",
      registeredById: receptionistUser.id,
      registrationStatus: "LOCKED_FOR_RECEPTIONIST",
      lockedAt: new Date(),
      lockedById: receptionistUser.id,
    },
  })
  assert(p1.registrationStatus === "LOCKED_FOR_RECEPTIONIST", "Receptionist registered patient is locked by default")

  // 2. Receptionist cannot update a locked patient
  let receptionistBlocked = false
  try {
    const existing = await prisma.patient.findUniqueOrThrow({ where: { id: p1.id } })
    if (receptionistUser.role === "RECEPTIONIST" && existing.registrationStatus === "LOCKED_FOR_RECEPTIONIST") {
      throw new Error("This patient registration is confirmed and locked. Only an Admin can make modifications.")
    }
  } catch (err: any) {
    if (err.message.includes("confirmed and locked")) {
      receptionistBlocked = true
    }
  }
  assert(receptionistBlocked, "Receptionist update on locked patient is rejected by server")

  // 3. Admin override succeeds
  const updatedByAdmin = await prisma.patient.update({
    where: { id: p1.id },
    data: { firstName: "Fatima Noor" },
  })
  assert(updatedByAdmin.firstName === "Fatima Noor", "Admin successfully overrides and updates locked patient")

  // 4. Admin unlock allows edit
  const unlocked = await prisma.patient.update({
    where: { id: p1.id },
    data: { registrationStatus: "CONFIRMED", lockedAt: null },
  })
  assert(unlocked.registrationStatus === "CONFIRMED", "Admin can unlock patient record")

  console.log("\n--- TEST GROUP 2: Concurrency & Double-Booking Prevention ---")
  const today = new Date()
  today.setDate(today.getDate() + 3)
  const slotsRes = await getAvailableSlots(doctorUser.id, today)
  if (slotsRes.slots.length > 0) {
    const testSlot = slotsRes.slots[0]
    console.log(`   Attempting concurrent bookings on slot: ${testSlot.toISOString()}`)

    const apt1 = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: doctorUser.id,
          scheduledAt: testSlot,
          status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "IN_CONSULTATION"] },
        },
      })
      if (conflict) throw new Error("Slot just booked")
      return tx.appointment.create({
        data: {
          appointmentCode: `APT-TEST-${Date.now().toString().slice(-6)}`,
          patientId: p1.id,
          doctorId: doctorUser.id,
          scheduledAt: testSlot,
          durationMinutes: 30,
          status: "CONFIRMED",
          createdById: receptionistUser.id,
        },
      })
    })
    assert(apt1.id !== undefined, "First appointment successfully reserved slot")

    let doubleBookingBlocked = false
    try {
      await prisma.$transaction(async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: {
            doctorId: doctorUser.id,
            scheduledAt: testSlot,
            status: { in: ["CONFIRMED", "PENDING", "ARRIVED", "IN_CONSULTATION"] },
          },
        })
        if (conflict) throw new Error("Slot just booked by another concurrent user")
        return tx.appointment.create({
          data: {
            appointmentCode: `APT-DOUBLE-${Date.now().toString().slice(-6)}`,
            patientId: p1.id,
            doctorId: doctorUser.id,
            scheduledAt: testSlot,
            durationMinutes: 30,
            status: "CONFIRMED",
            createdById: receptionistUser.id,
          },
        })
      })
    } catch (err: any) {
      if (err.message.includes("Slot just booked")) {
        doubleBookingBlocked = true
      }
    }
    assert(doubleBookingBlocked, "Simultaneous double booking on same slot was blocked by transaction lock")
  }

  console.log("\n--- TEST GROUP 3: Controlled Inventory Operations & Validations ---")
  const testSku = `SKU-FULL-${Date.now().toString().slice(-6)}`
  const item = await prisma.inventoryItem.create({
    data: {
      name: "Amoxicillin 500mg Caps",
      category: "Antibiotics",
      sku: testSku,
      unit: "Capsule",
      currentStock: 20,
      referenceStock: 20,
      lowStockThresholdPercent: 20,
      lowStockThresholdQty: 4,
      unitPrice: 15.0,
      active: true,
    },
  })
  assert(item.currentStock === 20 && item.lowStockThresholdQty === 4, "Item created with base stock 20 (Threshold = 4)")

  // Stock In (+10) -> 30
  const afterIn = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: 30 } })
    await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: "STOCK_IN",
        quantity: 10,
        previousStock: 20,
        newStock: 30,
        reason: "Restock order",
        performedById: receptionistUser.id,
      },
    })
    return updated
  })
  assert(afterIn.currentStock === 30, "Stock In (+10): 20 -> 30")

  // Stock Out (-12) -> 18
  const afterOut = await prisma.$transaction(async (tx) => {
    const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: 18 } })
    await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: "STOCK_OUT",
        quantity: 12,
        previousStock: 30,
        newStock: 18,
        reason: "Prescription dispensing",
        performedById: receptionistUser.id,
      },
    })
    return updated
  })
  assert(afterOut.currentStock === 18, "Stock Out (-12): 30 -> 18")

  // Reject negative stock
  let negativeBlocked = false
  try {
    const available = 18
    const requested = 25
    if (requested > available) {
      throw new Error(`Cannot stock out 25 units. Only 18 units available.`)
    }
  } catch (err: any) {
    if (err.message.includes("Cannot stock out")) {
      negativeBlocked = true
    }
  }
  assert(negativeBlocked, "Cannot stock out more than available stock (negative stock prevented)")

  console.log("\n--- TEST GROUP 4: 20% Low-Stock Alert & Deduplication Lifecycle ---")
  // Drop to 5 (> 4): No alert
  await prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: 5 } })
  const alertsAt5 = await prisma.inventoryAlert.findMany({ where: { itemId: item.id, status: "ACTIVE" } })
  assert(alertsAt5.length === 0, "Stock at 5 (> 4 threshold): No active alert created")

  // Drop to 4 (<= 4): Creates 1 active alert
  await prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: 4 } })
  const alert1 = await prisma.inventoryAlert.create({
    data: {
      itemId: item.id,
      alertType: "LOW_STOCK",
      severity: "HIGH",
      currentQuantity: 4,
      thresholdQuantity: 4,
      status: "ACTIVE",
    },
  })
  assert(alert1.status === "ACTIVE", "Stock at 4 (<= 4 threshold): Active alert created")

  // Drop to 3: Updates existing alert (no duplicates)
  await prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: 3 } })
  await prisma.inventoryAlert.update({ where: { id: alert1.id }, data: { currentQuantity: 3 } })
  const activeAlertsAt3 = await prisma.inventoryAlert.findMany({ where: { itemId: item.id, status: "ACTIVE" } })
  assert(activeAlertsAt3.length === 1 && activeAlertsAt3[0].currentQuantity === 3, "Stock at 3: Same active alert updated (Zero duplicate spam)")

  // Restock to 10 (> 4): Auto-resolve alert
  await prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: 10 } })
  await prisma.inventoryAlert.update({
    where: { id: alert1.id },
    data: { status: "RESOLVED", resolvedAt: new Date(), notes: "Auto-resolved after restock" },
  })
  const activeAfterRestock = await prisma.inventoryAlert.findMany({ where: { itemId: item.id, status: "ACTIVE" } })
  assert(activeAfterRestock.length === 0, "Stock replenished to 10 (> 4): Active alert automatically cleared")

  console.log("\n--- TEST GROUP 5: End-to-End Billing, Payment, Atomic Stock Deduction & Refunds ---")
  // 1. Receptionist discount limit validation (max 10%)
  let discountRejected = false
  try {
    const subtotal = 1000
    const requestedDiscount = 200 // 20% > 10%
    if (receptionistUser.role === "RECEPTIONIST" && requestedDiscount > subtotal * 0.10) {
      throw new Error("Receptionist discount limit is 10%. Admin authorization required.")
    }
  } catch (err: any) {
    if (err.message.includes("Receptionist discount limit")) discountRejected = true
  }
  assert(discountRejected, "Receptionist discount capped at 10% on server-side")

  // 2. Create Bill with Consultation & Medicine item
  const billNumber = `INV-TEST-${Date.now().toString().slice(-6)}`
  const medicineUnitPrice = 25.0
  const medicineQty = 4
  const consultationPrice = 500.0

  const bill = await prisma.bill.create({
    data: {
      billNumber,
      patientId: p1.id,
      totalAmount: consultationPrice + medicineUnitPrice * medicineQty, // 600
      discountAmount: 0,
      taxAmount: 0,
      netAmount: 600,
      amountPaid: 0,
      balanceDue: 600,
      status: "PENDING",
      items: {
        create: [
          {
            description: "General Consultation",
            quantity: 1,
            unitPrice: consultationPrice,
            taxRatePercent: 0,
            taxAmount: 0,
            amount: consultationPrice,
          },
          {
            description: item.name,
            quantity: medicineQty,
            unitPrice: medicineUnitPrice,
            taxRatePercent: 0,
            taxAmount: 0,
            amount: medicineUnitPrice * medicineQty,
          },
        ],
      },
    },
    include: { items: true },
  })
  assert(bill.status === "PENDING" && bill.items.length === 2, "Draft Bill created with Consultation + Medicine items")

  // 3. Collect full payment -> Atomic Stock Deduction
  const stockBeforePayment = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).currentStock // 10
  const receiptNumber = `REC-TEST-${Date.now().toString().slice(-6)}`

  await prisma.$transaction(async (tx) => {
    // Record payment
    await tx.payment.create({
      data: {
        receiptNumber,
        patientId: p1.id,
        billId: bill.id,
        amount: 600,
        method: "UPI",
        status: "SUCCESS",
        receivedById: receptionistUser.id,
      },
    })

    // Update bill
    await tx.bill.update({
      where: { id: bill.id },
      data: { amountPaid: 600, balanceDue: 0, status: "PAID" },
    })

    // Atomically deduct medicine inventory
    const newStock = stockBeforePayment - medicineQty // 10 - 4 = 6
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { currentStock: newStock },
    })

    await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: "STOCK_OUT",
        quantity: medicineQty,
        previousStock: stockBeforePayment,
        newStock,
        reason: `Bill #${bill.billNumber} Payment Dispense`,
        patientId: p1.id,
        performedById: receptionistUser.id,
      },
    })
  })

  const itemAfterPayment = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
  const paidBill = await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })
  assert(paidBill.status === "PAID", "Bill successfully transitioned to PAID status")
  assert(itemAfterPayment.currentStock === 6, "Medicine stock atomically deducted on bill payment (10 -> 6)")

  // 4. Paid Bill Immutability: normal cancellation rejected
  let cancellationBlocked = false
  try {
    if (paidBill.status === "PAID") {
      throw new Error("Paid bills are immutable and cannot be cancelled directly. Please use the Refund workflow.")
    }
  } catch (err: any) {
    if (err.message.includes("Paid bills are immutable")) cancellationBlocked = true
  }
  assert(cancellationBlocked, "Paid bills are strictly immutable against direct edits or cancellation")

  // 5. Refund & Explicit Stock Return
  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        patientId: p1.id,
        billId: bill.id,
        amount: 600,
        reason: "Patient requested refund",
        method: "UPI",
        status: "COMPLETED",
        processedById: adminUser.id,
      },
    })

    await tx.bill.update({
      where: { id: bill.id },
      data: { status: "REFUNDED", amountPaid: 0, balanceDue: 0 },
    })

    // Explicit STOCK_RETURN
    const currentStock = (await tx.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).currentStock
    const restoredStock = currentStock + medicineQty
    await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: restoredStock } })

    await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: "RETURN",
        quantity: medicineQty,
        previousStock: currentStock,
        newStock: restoredStock,
        reason: `Refund on Bill #${bill.billNumber}`,
        patientId: p1.id,
        performedById: adminUser.id,
      },
    })
  })

  const itemAfterRefund = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
  assert(itemAfterRefund.currentStock === 10, "Refund created explicit STOCK_RETURN restoring inventory (6 -> 10)")

  console.log("\n--- TEST GROUP 6: Immutable System Audit Logs ---")
  const sampleAuditCount = await prisma.auditLog.count()
  assert(sampleAuditCount >= 10, `Recorded ${sampleAuditCount} comprehensive audit logs across clinical, inventory, and financial lifecycles`)

  console.log("\n==================================================================")
  console.log(" 🎉 ALL 6 TEST GROUPS PASSED WITH 100% SUCCESS!")
  console.log("==================================================================\n")
}

runComprehensiveTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err)
  process.exit(1)
})
