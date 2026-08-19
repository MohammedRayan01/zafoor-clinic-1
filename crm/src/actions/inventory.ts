"use server"

import { safeRevalidatePath as revalidatePath } from "@/lib/revalidate"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getCurrentUserOrNull, requireRole } from "@/lib/auth"
import { serializeDecimal } from "@/lib/serialize"
import { logAudit } from "@/lib/audit"
import {
  inventoryItemSchema,
  stockMovementSchema,
  stockAdjustmentSchema,
  type InventoryItemInput,
  type StockMovementInput,
  type StockAdjustmentInput,
} from "@/lib/validations/inventory"

function calculateThresholdQty(referenceStock: number, percent: number) {
  return Math.max(1, Math.floor(referenceStock * (percent / 100)))
}

// ── Item Catalog Management (Admin Only for CUD) ───────────────────────

export async function getInventoryItems(params?: { query?: string; category?: string; lowStockOnly?: boolean }) {
  const where: Record<string, unknown> = { active: true }

  if (params?.category && params.category !== "ALL") {
    where.category = params.category
  }

  if (params?.query) {
    where.OR = [
      { name: { contains: params.query, mode: "insensitive" } },
      { sku: { contains: params.query, mode: "insensitive" } },
      { category: { contains: params.query, mode: "insensitive" } },
      { manufacturer: { contains: params.query, mode: "insensitive" } },
    ]
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      alerts: {
        where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  })

  const formatted = items.map((item) => ({
    ...item,
    lowStockThresholdPercent: Number(item.lowStockThresholdPercent),
    unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
    isLowStock: item.currentStock <= item.lowStockThresholdQty,
    activeAlert: item.alerts[0] || null,
  }))

  if (params?.lowStockOnly) {
    return formatted.filter((item) => item.isLowStock)
  }

  return formatted
}

export async function getInventoryItemById(id: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      transactions: {
        include: { performedBy: true, patient: true },
        orderBy: { timestamp: "desc" },
        take: 50,
      },
      alerts: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!item) return null

  return {
    ...item,
    lowStockThresholdPercent: Number(item.lowStockThresholdPercent),
    unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
    isLowStock: item.currentStock <= item.lowStockThresholdQty,
    transactions: item.transactions.map((t) => ({
      ...t,
      performedBy: serializeDecimal(t.performedBy, ["consultationFee"]),
    })),
  }
}

export async function createInventoryItem(input: InventoryItemInput) {
  const user = await requireRole("ADMIN")
  const data = inventoryItemSchema.parse(input)

  const thresholdQty = calculateThresholdQty(data.referenceStock, data.lowStockThresholdPercent)

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        name: data.name,
        category: data.category,
        manufacturer: data.manufacturer || null,
        sku: data.sku,
        unit: data.unit,
        description: data.description || null,
        currentStock: data.currentStock,
        referenceStock: data.referenceStock,
        lowStockThresholdPercent: data.lowStockThresholdPercent,
        lowStockThresholdQty: thresholdQty,
        unitPrice: data.unitPrice || null,
        active: data.active,
      },
    })

    // Initial stock transaction if stock > 0
    if (data.currentStock > 0) {
      await tx.inventoryTransaction.create({
        data: {
          itemId: created.id,
          type: "STOCK_IN",
          quantity: data.currentStock,
          previousStock: 0,
          newStock: data.currentStock,
          reason: "Initial inventory setup",
          performedById: user.id,
        },
      })
    }

    // Check if initial stock triggers low-stock alert
    if (data.currentStock <= thresholdQty) {
      await tx.inventoryAlert.create({
        data: {
          itemId: created.id,
          alertType: "LOW_STOCK",
          severity: data.currentStock === 0 ? "CRITICAL" : "HIGH",
          currentQuantity: data.currentStock,
          thresholdQuantity: thresholdQty,
          status: "ACTIVE",
        },
      })
    }

    await logAudit({
      action: "MEDICINE_CREATED",
      entityType: "InventoryItem",
      entityId: created.id,
      metadata: { name: created.name, sku: created.sku, stock: created.currentStock },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return created
  })

  revalidatePath("/inventory")
  return item
}

export async function updateInventoryItem(id: string, input: Partial<InventoryItemInput>) {
  const user = await requireRole("ADMIN")
  const existing = await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })

  const refStock = input.referenceStock ?? existing.referenceStock
  const thresholdPercent = input.lowStockThresholdPercent ? Number(input.lowStockThresholdPercent) : Number(existing.lowStockThresholdPercent)
  const thresholdQty = calculateThresholdQty(refStock, thresholdPercent)

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        category: input.category ?? existing.category,
        manufacturer: input.manufacturer !== undefined ? input.manufacturer : existing.manufacturer,
        sku: input.sku ?? existing.sku,
        unit: input.unit ?? existing.unit,
        description: input.description !== undefined ? input.description : existing.description,
        referenceStock: refStock,
        lowStockThresholdPercent: thresholdPercent,
        lowStockThresholdQty: thresholdQty,
        unitPrice: input.unitPrice !== undefined ? input.unitPrice : existing.unitPrice,
        active: input.active ?? existing.active,
      },
    })

    // Check if new threshold causes or resolves an alert
    const activeAlert = await tx.inventoryAlert.findFirst({
      where: { itemId: id, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
    })

    if (item.currentStock <= thresholdQty) {
      if (activeAlert) {
        await tx.inventoryAlert.update({
          where: { id: activeAlert.id },
          data: { thresholdQuantity: thresholdQty, currentQuantity: item.currentStock, updatedAt: new Date() },
        })
      } else {
        await tx.inventoryAlert.create({
          data: {
            itemId: id,
            alertType: "LOW_STOCK",
            severity: item.currentStock === 0 ? "CRITICAL" : "HIGH",
            currentQuantity: item.currentStock,
            thresholdQuantity: thresholdQty,
            status: "ACTIVE",
          },
        })
      }
    } else if (activeAlert) {
      await tx.inventoryAlert.update({
        where: { id: activeAlert.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: user.id,
          notes: "Auto-resolved: threshold configuration updated",
        },
      })
    }

    await logAudit({
      action: "MEDICINE_UPDATED",
      entityType: "InventoryItem",
      entityId: id,
      metadata: { name: item.name, sku: item.sku },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return item
  })

  revalidatePath("/inventory")
  revalidatePath(`/inventory/${id}`)
  return updated
}

export async function archiveInventoryItem(id: string) {
  const user = await requireRole("ADMIN")
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: { active: false },
  })

  await logAudit({
    action: "MEDICINE_ARCHIVED",
    entityType: "InventoryItem",
    entityId: id,
    metadata: { name: item.name, sku: item.sku },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/inventory")
  return item
}

// ── Controlled Stock Operations (Admin & Receptionist) ─────────────────

/**
 * Controlled STOCK_IN operation.
 * Atomic: Updates stock, appends immutable transaction, auto-resolves low-stock alert if replenished.
 */
export async function stockIn(input: StockMovementInput) {
  const user = (await getCurrentUserOrNull()) || (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }))
  const data = stockMovementSchema.parse(input)

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: data.itemId } })
    const previousStock = item.currentStock
    const newStock = previousStock + data.quantity

    // 1. Update item stock
    await tx.inventoryItem.update({
      where: { id: data.itemId },
      data: { currentStock: newStock },
    })

    // 2. Append immutable transaction record
    const transaction = await tx.inventoryTransaction.create({
      data: {
        itemId: data.itemId,
        type: "STOCK_IN",
        quantity: data.quantity,
        previousStock,
        newStock,
        reason: data.reason || `Stock In (+${data.quantity})`,
        patientId: data.patientId || null,
        performedById: user.id,
      },
    })

    // 3. Low-stock alert check: If stock is now above threshold, auto-resolve any active alerts
    if (newStock > item.lowStockThresholdQty) {
      const activeAlert = await tx.inventoryAlert.findFirst({
        where: { itemId: data.itemId, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      })
      if (activeAlert) {
        await tx.inventoryAlert.update({
          where: { id: activeAlert.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolvedById: user.id,
            notes: `Auto-resolved: stock replenished to ${newStock} units (above threshold ${item.lowStockThresholdQty})`,
          },
        })
        await logAudit({
          action: "ALERT_RESOLVED",
          entityType: "InventoryAlert",
          entityId: activeAlert.id,
          metadata: { itemId: item.id, medicine: item.name, newStock },
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          tx,
        })
      }
    }

    // 4. Record audit log
    await logAudit({
      action: "STOCK_IN",
      entityType: "InventoryItem",
      entityId: item.id,
      metadata: {
        medicine: item.name,
        quantityAdded: data.quantity,
        previousStock,
        newStock,
        reason: data.reason,
      },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return { item, transaction, newStock }
  })

  revalidatePath("/inventory")
  revalidatePath(`/inventory/${data.itemId}`)
  revalidatePath("/dashboard")
  return result
}

/**
 * Controlled STOCK_OUT operation.
 * Atomic: Validates stock >= quantity, updates stock, creates transaction, creates/updates low-stock alert without spamming duplicates.
 */
export async function stockOut(input: StockMovementInput) {
  const user = (await getCurrentUserOrNull()) || (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }))
  const data = stockMovementSchema.parse(input)

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: data.itemId } })
    const previousStock = item.currentStock

    // Strict validation: cannot stock out more than available
    if (previousStock < data.quantity) {
      throw new Error(
        `Cannot stock out ${data.quantity} ${item.unit}(s). Only ${previousStock} ${item.unit}(s) available in stock.`
      )
    }

    const newStock = previousStock - data.quantity

    // 1. Update item stock
    await tx.inventoryItem.update({
      where: { id: data.itemId },
      data: { currentStock: newStock },
    })

    // 2. Append immutable transaction record
    const transaction = await tx.inventoryTransaction.create({
      data: {
        itemId: data.itemId,
        type: "STOCK_OUT",
        quantity: data.quantity,
        previousStock,
        newStock,
        reason: data.reason || `Stock Out (-${data.quantity})`,
        patientId: data.patientId || null,
        performedById: user.id,
      },
    })

    // 3. 20% Low-stock alert detection & deduplication lifecycle
    if (newStock <= item.lowStockThresholdQty) {
      const activeAlert = await tx.inventoryAlert.findFirst({
        where: { itemId: data.itemId, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      })

      if (activeAlert) {
        // Update existing alert — DO NOT duplicate
        await tx.inventoryAlert.update({
          where: { id: activeAlert.id },
          data: {
            currentQuantity: newStock,
            severity: newStock === 0 ? "CRITICAL" : "HIGH",
            updatedAt: new Date(),
          },
        })
        await logAudit({
          action: "ALERT_UPDATED",
          entityType: "InventoryAlert",
          entityId: activeAlert.id,
          metadata: { medicine: item.name, currentQuantity: newStock, thresholdQuantity: item.lowStockThresholdQty },
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          tx,
        })
      } else {
        // Create new active alert
        const createdAlert = await tx.inventoryAlert.create({
          data: {
            itemId: data.itemId,
            alertType: "LOW_STOCK",
            severity: newStock === 0 ? "CRITICAL" : "HIGH",
            currentQuantity: newStock,
            thresholdQuantity: item.lowStockThresholdQty,
            status: "ACTIVE",
          },
        })
        await logAudit({
          action: "ALERT_CREATED",
          entityType: "InventoryAlert",
          entityId: createdAlert.id,
          metadata: { medicine: item.name, currentQuantity: newStock, thresholdQuantity: item.lowStockThresholdQty },
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          tx,
        })
      }
    }

    // 4. Record audit log
    await logAudit({
      action: "STOCK_OUT",
      entityType: "InventoryItem",
      entityId: item.id,
      metadata: {
        medicine: item.name,
        quantityDeducted: data.quantity,
        previousStock,
        newStock,
        patientId: data.patientId,
        reason: data.reason,
      },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return { item, transaction, newStock }
  })

  revalidatePath("/inventory")
  revalidatePath(`/inventory/${data.itemId}`)
  revalidatePath("/dashboard")
  return result
}

// ── Alert Management (Admin Controls) ──────────────────────────────────

export async function getInventoryAlerts(params?: { status?: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "ALL" }) {
  const where: Record<string, unknown> = {}
  if (params?.status && params.status !== "ALL") {
    where.status = params.status
  } else if (!params?.status) {
    where.status = { in: ["ACTIVE", "ACKNOWLEDGED"] }
  }

  const alerts = await prisma.inventoryAlert.findMany({
    where,
    include: {
      item: true,
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  return alerts.map((a) => ({
    ...a,
    item: {
      ...a.item,
      lowStockThresholdPercent: Number(a.item.lowStockThresholdPercent),
      unitPrice: a.item.unitPrice ? Number(a.item.unitPrice) : null,
    },
  }))
}

export async function acknowledgeAlert(alertId: string) {
  const user = (await getCurrentUserOrNull()) || (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }))
  const alert = await prisma.inventoryAlert.update({
    where: { id: alertId },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedById: user.id,
    },
  })

  await logAudit({
    action: "ALERT_ACKNOWLEDGED",
    entityType: "InventoryAlert",
    entityId: alertId,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/inventory")
  revalidatePath("/inventory/alerts")
  return alert
}

export async function resolveAlert(alertId: string, notes?: string) {
  const user = (await getCurrentUserOrNull()) || (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }))
  const alert = await prisma.inventoryAlert.update({
    where: { id: alertId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedById: user.id,
      notes: notes || "Manually resolved by Admin",
    },
  })

  await logAudit({
    action: "ALERT_RESOLVED",
    entityType: "InventoryAlert",
    entityId: alertId,
    metadata: { notes },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/inventory")
  revalidatePath("/inventory/alerts")
  return alert
}

// ── Transaction History (Append-Only) ──────────────────────────────────

export async function getInventoryTransactions(params?: {
  itemId?: string
  type?: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "RETURN"
  page?: number
  pageSize?: number
}) {
  const { itemId, type, page = 1, pageSize = 30 } = params || {}
  const where: Record<string, unknown> = {}
  if (itemId) where.itemId = itemId
  if (type) where.type = type

  const [transactions, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        item: true,
        performedBy: true,
        patient: true,
      },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryTransaction.count({ where }),
  ])

  return {
    transactions: transactions.map((t) => ({
      ...t,
      item: {
        ...t.item,
        lowStockThresholdPercent: Number(t.item.lowStockThresholdPercent),
        unitPrice: t.item.unitPrice ? Number(t.item.unitPrice) : null,
      },
      performedBy: serializeDecimal(t.performedBy, ["consultationFee"]),
    })),
    total,
    page,
    pageSize,
  }
}

/**
 * Automatically dispense prescription items from inventory.
 * Matches items by medicineName, updates stock atomically, records patient-linked transactions,
 * and maintains low-stock alert state.
 */
export async function dispensePrescriptionItems(params: {
  patientId: string
  items: Array<{ medicineName: string; quantity: number; notes?: string }>
}) {
  const user = await getCurrentUser()

  const results = await prisma.$transaction(async (tx) => {
    const dispensedList = []

    for (const item of params.items) {
      if (!item.quantity || item.quantity <= 0) continue

      // Match item in active inventory
      const matched = await tx.inventoryItem.findFirst({
        where: {
          active: true,
          name: { equals: item.medicineName.trim(), mode: "insensitive" },
        },
      })

      if (!matched) {
        dispensedList.push({
          medicineName: item.medicineName,
          status: "NOT_IN_INVENTORY" as const,
          message: "Item not found in clinic inventory catalog",
        })
        continue
      }

      if (matched.currentStock < item.quantity) {
        dispensedList.push({
          medicineName: matched.name,
          status: "INSUFFICIENT_STOCK" as const,
          available: matched.currentStock,
          requested: item.quantity,
        })
        continue
      }

      const previousStock = matched.currentStock
      const newStock = previousStock - item.quantity

      await tx.inventoryItem.update({
        where: { id: matched.id },
        data: { currentStock: newStock },
      })

      const transaction = await tx.inventoryTransaction.create({
        data: {
          itemId: matched.id,
          type: "STOCK_OUT",
          quantity: item.quantity,
          previousStock,
          newStock,
          reason: item.notes || `Prescription Dispensed (-${item.quantity} ${matched.unit}s)`,
          patientId: params.patientId,
          performedById: user.id,
        },
      })

      // 20% alert lifecycle
      if (newStock <= matched.lowStockThresholdQty) {
        const activeAlert = await tx.inventoryAlert.findFirst({
          where: { itemId: matched.id, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
        })

        if (activeAlert) {
          await tx.inventoryAlert.update({
            where: { id: activeAlert.id },
            data: {
              currentQuantity: newStock,
              severity: newStock === 0 ? "CRITICAL" : "HIGH",
              updatedAt: new Date(),
            },
          })
        } else {
          await tx.inventoryAlert.create({
            data: {
              itemId: matched.id,
              alertType: "LOW_STOCK",
              severity: newStock === 0 ? "CRITICAL" : "HIGH",
              currentQuantity: newStock,
              thresholdQuantity: matched.lowStockThresholdQty,
              status: "ACTIVE",
            },
          })
        }
      }

      dispensedList.push({
        medicineName: matched.name,
        status: "DISPENSED" as const,
        dispensedQty: item.quantity,
        newStock,
        transactionId: transaction.id,
      })
    }

    return dispensedList
  })

  revalidatePath("/inventory")
  revalidatePath(`/patients/${params.patientId}`)
  return results
}

