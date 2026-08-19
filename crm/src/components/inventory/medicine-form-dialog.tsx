"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus, Pencil, Loader2 } from "lucide-react"
import { createInventoryItem, updateInventoryItem } from "@/actions/inventory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MedicineFormDialogProps {
  item?: {
    id: string
    name: string
    category: string
    manufacturer?: string | null
    sku: string
    unit: string
    description?: string | null
    currentStock: number
    referenceStock: number
    lowStockThresholdPercent: number
    unitPrice?: number | null
  }
  trigger?: React.ReactNode
}

const CATEGORIES = [
  "Syrup",
  "Tablet",
  "Capsule",
  "Topical / Cream",
  "Injection",
  "Supplements",
  "Consumables",
  "Diagnostic Kits",
  "Other",
]

const UNITS = ["Bottle", "Strip", "Box", "Vial", "Tube", "Piece", "Pack", "Unit"]

export function MedicineFormDialog({ item, trigger }: MedicineFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const isEdit = !!item

  const [name, setName] = useState(item?.name || "")
  const [category, setCategory] = useState(item?.category || "Tablet")
  const [manufacturer, setManufacturer] = useState(item?.manufacturer || "")
  const [sku, setSku] = useState(item?.sku || "")
  const [unit, setUnit] = useState(item?.unit || "Strip")
  const [description, setDescription] = useState(item?.description || "")
  const [currentStock, setCurrentStock] = useState(item?.currentStock ?? 0)
  const [referenceStock, setReferenceStock] = useState(item?.referenceStock ?? 20)
  const [thresholdPercent, setThresholdPercent] = useState(item?.lowStockThresholdPercent ?? 20)
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice?.toString() || "")

  const thresholdQty = Math.max(1, Math.floor(referenceStock * (thresholdPercent / 100)))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !sku.trim()) {
      toast.error("Name and SKU/Code are required")
      return
    }

    startTransition(async () => {
      try {
        if (isEdit && item) {
          await updateInventoryItem(item.id, {
            name: name.trim(),
            category,
            manufacturer: manufacturer.trim() || undefined,
            sku: sku.trim(),
            unit,
            description: description.trim() || undefined,
            referenceStock,
            lowStockThresholdPercent: thresholdPercent,
            unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
          })
          toast.success("Medicine metadata updated")
        } else {
          await createInventoryItem({
            name: name.trim(),
            category,
            manufacturer: manufacturer.trim() || undefined,
            sku: sku.trim(),
            unit,
            description: description.trim() || undefined,
            currentStock,
            referenceStock,
            lowStockThresholdPercent: thresholdPercent,
            unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
            active: true,
          })
          toast.success("Medicine registered in inventory")
        }
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save medicine")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as any) : undefined}>
        {!trigger &&
          (isEdit ? (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
          ) : (
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Medicine
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Medicine" : "Add Medicine to Inventory"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update product metadata, reference stock, and threshold levels."
                : "Register a new medicine or clinic consumable with stock tracking."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="med-name">Medicine Name *</Label>
              <Input
                id="med-name"
                placeholder="e.g. Benadryl Syrup 100ml"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="med-sku">SKU / Product Code *</Label>
              <Input
                id="med-sku"
                placeholder="e.g. MED-BEN-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                items={Object.fromEntries(CATEGORIES.map((c) => [c, c]))}
                value={category}
                onValueChange={(val) => setCategory(val ?? "Tablet")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="med-mfg">Manufacturer</Label>
              <Input
                id="med-mfg"
                placeholder="e.g. Johnson & Johnson"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Unit of Dispensing</Label>
              <Select
                items={Object.fromEntries(UNITS.map((u) => [u, u]))}
                value={unit}
                onValueChange={(val) => setUnit(val ?? "Strip")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isEdit && (
              <div className="space-y-1.5">
                <Label htmlFor="med-initial-stock">Initial Stock Quantity</Label>
                <Input
                  id="med-initial-stock"
                  type="number"
                  min={0}
                  value={currentStock}
                  onChange={(e) => setCurrentStock(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="med-ref-stock">Reference / Base Stock *</Label>
              <Input
                id="med-ref-stock"
                type="number"
                min={1}
                value={referenceStock}
                onChange={(e) => setReferenceStock(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="med-threshold-percent">Low-Stock Alert Threshold (%)</Label>
              <Input
                id="med-threshold-percent"
                type="number"
                min={1}
                max={100}
                value={thresholdPercent}
                onChange={(e) => setThresholdPercent(Math.min(100, Math.max(1, parseInt(e.target.value) || 20)))}
              />
              <p className="text-xs text-muted-foreground">
                Alert triggers at: <span className="font-semibold text-amber-600">≤ {thresholdQty} {unit}s</span> ({thresholdPercent}% of {referenceStock})
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="med-price">Unit Price (₹ / Optional)</Label>
              <Input
                id="med-price"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="med-desc">Description / Clinical Notes</Label>
              <Textarea
                id="med-desc"
                placeholder="Dosage strength, storage temperature, or clinical usage notes..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {isEdit ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
