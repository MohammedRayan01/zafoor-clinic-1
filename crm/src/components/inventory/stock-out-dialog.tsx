"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowUpFromLine, Loader2 } from "lucide-react"
import { stockOut } from "@/actions/inventory"
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

interface StockOutDialogProps {
  item: {
    id: string
    name: string
    sku: string
    unit: string
    currentStock: number
    lowStockThresholdQty: number
  }
  defaultPatientId?: string
  defaultPatientName?: string
  trigger?: React.ReactNode
}

export function StockOutDialog({ item, defaultPatientId, defaultPatientName, trigger }: StockOutDialogProps) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [patientId, setPatientId] = useState(defaultPatientId || "")
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  const isExceeding = quantity > item.currentStock
  const resultingStock = item.currentStock - quantity

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (quantity <= 0) {
      toast.error("Quantity must be at least 1")
      return
    }
    if (isExceeding) {
      toast.error(`Cannot stock out ${quantity}. Only ${item.currentStock} available.`)
      return
    }

    startTransition(async () => {
      try {
        const res = await stockOut({
          itemId: item.id,
          quantity,
          patientId: patientId.trim() || undefined,
          reason: reason.trim() || `Dispensed / Used (-${quantity} ${item.unit})`,
        })
        toast.success(`Deducted ${quantity} ${item.unit}(s) from ${item.name}. Remaining: ${res.newStock}`)
        setOpen(false)
        setQuantity(1)
        setReason("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record stock out")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as any) : undefined}>
        {!trigger && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            disabled={item.currentStock <= 0}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-600" />
            Stock Out
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Stock Out — {item.name}</DialogTitle>
            <DialogDescription>
              Record dispensed or consumed stock. Current available:{" "}
              <strong className="text-foreground">
                {item.currentStock} {item.unit}s
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="stock-out-qty">Quantity to Deduct ({item.unit}s) *</Label>
              <Input
                id="stock-out-qty"
                type="number"
                min={1}
                max={item.currentStock}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
              <div className="flex items-center justify-between text-xs mt-1">
                <span className={isExceeding ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  {isExceeding
                    ? `⚠️ Exceeds stock by ${quantity - item.currentStock}`
                    : `Remaining stock: ${resultingStock} ${item.unit}s`}
                </span>
                {resultingStock <= item.lowStockThresholdQty && resultingStock >= 0 && (
                  <span className="text-amber-600 font-medium">
                    ⚠️ Will trigger 20% Low-Stock Alert (≤ {item.lowStockThresholdQty})
                  </span>
                )}
              </div>
            </div>

            {defaultPatientName ? (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Dispensing to: </span>
                <span className="font-medium text-foreground">{defaultPatientName}</span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="stock-out-reason">Reason / Dispensing Notes (Optional)</Label>
              <Textarea
                id="stock-out-reason"
                placeholder="e.g. Dispensed to patient for prescription, Treatment tray usage"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || isExceeding || item.currentStock <= 0}
              variant="destructive"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirm Stock Out (-{quantity})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
