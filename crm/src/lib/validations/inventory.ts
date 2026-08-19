import { z } from "zod"

export const inventoryItemSchema = z.object({
  name: z.string().min(1, "Medicine/Item name is required"),
  category: z.string().min(1, "Category is required").default("Medicine"),
  manufacturer: z.string().optional(),
  sku: z.string().min(1, "SKU/Code is required"),
  unit: z.string().min(1, "Unit is required").default("Unit"),
  description: z.string().optional(),
  currentStock: z.coerce.number().int().min(0, "Stock cannot be negative").default(0),
  referenceStock: z.coerce.number().int().min(1, "Reference stock must be at least 1").default(20),
  lowStockThresholdPercent: z.coerce.number().min(1).max(100).default(20),
  unitPrice: z.coerce.number().min(0).optional(),
  active: z.boolean().default(true),
})

export const stockMovementSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  reason: z.string().optional(),
  patientId: z.string().optional(),
})

export const stockAdjustmentSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  newStock: z.coerce.number().int().min(0, "New stock cannot be negative"),
  reason: z.string().min(1, "Adjustment reason is required"),
})

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>
export type StockMovementInput = z.infer<typeof stockMovementSchema>
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
