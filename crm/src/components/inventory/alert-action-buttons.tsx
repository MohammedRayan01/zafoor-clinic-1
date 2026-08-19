"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { CheckCheck, Check, Loader2 } from "lucide-react"
import { acknowledgeAlert, resolveAlert } from "@/actions/inventory"
import { Button } from "@/components/ui/button"
import { StockInDialog } from "@/components/inventory/stock-in-dialog"

interface AlertActionButtonsProps {
  alert: {
    id: string
    itemId: string
    status: string
    currentQuantity: number
    thresholdQuantity: number
    item: {
      id: string
      name: string
      sku: string
      unit: string
      currentStock: number
    }
  }
  isAdmin: boolean
}

export function AlertActionButtons({ alert, isAdmin }: AlertActionButtonsProps) {
  const [pending, startTransition] = useTransition()

  function handleAcknowledge() {
    startTransition(async () => {
      try {
        await acknowledgeAlert(alert.id)
        toast.success("Alert acknowledged")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to acknowledge alert")
      }
    })
  }

  function handleResolve() {
    startTransition(async () => {
      try {
        await resolveAlert(alert.id)
        toast.success("Alert resolved")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to resolve alert")
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <StockInDialog item={alert.item} />

      {isAdmin && alert.status === "ACTIVE" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAcknowledge}
          disabled={pending}
          className="text-xs h-8"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1 text-blue-600" />}
          Acknowledge
        </Button>
      )}

      {isAdmin && (alert.status === "ACTIVE" || alert.status === "ACKNOWLEDGED") && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResolve}
          disabled={pending}
          className="text-xs h-8 text-emerald-600 border-emerald-500 hover:bg-emerald-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5 mr-1" />}
          Resolve
        </Button>
      )}
    </div>
  )
}
