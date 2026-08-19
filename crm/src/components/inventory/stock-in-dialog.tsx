"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowDownToLine, Loader2 } from "lucide-react"
import { stockIn } from "@/actions/inventory"
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

interface StockInDialogProps {
  item: {
    id: string
    name: string
    sku: string
    unit: string
    currentStock: number
  }
  trigger?: React.ReactNode
}

export function StockInDialog({ item, trigger }: StockInDialogProps) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (quantity <= 0) {
      toast.error("Quantity must be at least 1")
      return
    }

    startTransition(async () => {
      try {
        const res = await stockIn({
          itemId: item.id,
          quantity,
          reason: reason.trim() || `Restocked (+${quantity} ${item.unit})`,
        })
        toast.success(`Added ${quantity} ${item.unit}(s) to ${item.name}. New stock: ${res.newStock}`)
        setOpen(false)
        setQuantity(1)
        setReason("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record stock in")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as any) : undefined}>
        {!trigger && (
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
            Stock In
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Stock In — {item.name}</DialogTitle>
            <DialogDescription>
              Record incoming stock. Current stock is <strong className="text-foreground">{item.currentStock} {item.unit}s</strong> (SKU: {item.sku}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity to Add ({item.unit}s) *</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Resulting stock will be: <span className="font-semibold text-emerald-600">{item.currentStock + quantity} {item.unit}s</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason / Batch Notes (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g. Monthly supplier batch replenishment, PO #1042"
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
            <Button type="submit" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
              {pending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Confirm Stock In (+{quantity})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
