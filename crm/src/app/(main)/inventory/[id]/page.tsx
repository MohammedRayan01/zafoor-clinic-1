import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, History, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { getCurrentUser } from "@/lib/auth"
import { getInventoryItemById } from "@/actions/inventory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StockInDialog } from "@/components/inventory/stock-in-dialog"
import { StockOutDialog } from "@/components/inventory/stock-out-dialog"
import { MedicineFormDialog } from "@/components/inventory/medicine-form-dialog"

export default async function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const item = await getInventoryItemById(id)

  if (!item) notFound()

  const isAdmin = user.role === "ADMIN"
  const isOutOfStock = item.currentStock === 0
  const isLow = item.isLowStock && !isOutOfStock

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          nativeButton={false}
          render={
            <Link href="/inventory">
              <ArrowLeft className="h-4 w-4" />
              Back to Inventory
            </Link>
          }
        />
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{item.name}</h1>
              <Badge variant="outline" className="font-mono text-xs">{item.sku}</Badge>
              <Badge variant="secondary" className="text-xs">{item.category}</Badge>
            </div>
            {item.manufacturer && (
              <p className="text-sm text-muted-foreground mt-1">Manufacturer: {item.manufacturer}</p>
            )}
            {item.description && (
              <p className="text-sm text-muted-foreground/90 mt-2 max-w-2xl">{item.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <StockInDialog item={item} />
            <StockOutDialog item={item} />
            {isAdmin && <MedicineFormDialog item={item} />}
          </div>
        </div>

        {/* Stock Breakdown */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Current Stock</p>
            <p className="text-2xl font-bold mt-0.5">
              <span className={isOutOfStock ? "text-destructive" : isLow ? "text-amber-600" : "text-emerald-600"}>
                {item.currentStock}
              </span>{" "}
              <span className="text-sm font-normal text-muted-foreground">{item.unit}s</span>
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Reference Base Stock</p>
            <p className="text-2xl font-bold mt-0.5">{item.referenceStock} <span className="text-sm font-normal text-muted-foreground">{item.unit}s</span></p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Low-Stock Alert Level</p>
            <p className="text-2xl font-bold mt-0.5 text-amber-600">
              ≤ {item.lowStockThresholdQty} <span className="text-sm font-normal text-muted-foreground">({item.lowStockThresholdPercent}%)</span>
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Stock Status</p>
            <div className="mt-1.5">
              {isOutOfStock ? (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <XCircle className="h-3 w-3" /> Out of Stock
                </Badge>
              ) : isLow ? (
                <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-3 w-3" /> Low Stock
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-3 w-3" /> In Stock
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Movement & Dispensing Ledger</CardTitle>
            <p className="text-xs text-muted-foreground">Immutable audit history of all stock additions and deductions.</p>
          </div>
          <History className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Quantity</th>
                  <th className="px-4 py-2.5">Stock Delta</th>
                  <th className="px-4 py-2.5">Reason / Patient</th>
                  <th className="px-4 py-2.5">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {item.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  item.transactions.map((tx) => {
                    const isPlus = tx.type === "STOCK_IN"
                    return (
                      <tr key={tx.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {format(new Date(tx.timestamp), "dd MMM yyyy, HH:mm")}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={isPlus ? "outline" : "secondary"}
                            className={
                              isPlus
                                ? "text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-[11px]"
                                : "text-amber-700 bg-amber-100 dark:bg-amber-950/40 text-[11px]"
                            }
                          >
                            {tx.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums">
                          <span className={isPlus ? "text-emerald-600" : "text-amber-600"}>
                            {isPlus ? `+${tx.quantity}` : `-${tx.quantity}`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                          {tx.previousStock} → <strong className="text-foreground">{tx.newStock}</strong>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className="font-medium text-foreground">{tx.reason || "—"}</span>
                          {tx.patient && (
                            <Link href={`/patients/${tx.patient.id}`} className="block text-[11px] text-primary hover:underline">
                              Patient: {tx.patient.firstName} {tx.patient.lastName || ""} ({tx.patient.uhid})
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {tx.performedBy.name} ({tx.performedBy.role})
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
