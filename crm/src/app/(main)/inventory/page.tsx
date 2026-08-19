import Link from "next/link"
import { AlertTriangle, Boxes, History, CheckCircle2, XCircle } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { getInventoryItems, getInventoryAlerts } from "@/actions/inventory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InventoryTable } from "@/components/inventory/inventory-table"
import { MedicineFormDialog } from "@/components/inventory/medicine-form-dialog"

export default async function InventoryPage() {
  const user = await getCurrentUser()
  const [items, alerts] = await Promise.all([getInventoryItems(), getInventoryAlerts({ status: "ACTIVE" })])

  const totalItems = items.length
  const lowStockCount = items.filter((i) => i.isLowStock && i.currentStock > 0).length
  const outOfStockCount = items.filter((i) => i.currentStock === 0).length
  const inStockCount = totalItems - lowStockCount - outOfStockCount

  const isAdmin = user.role === "ADMIN"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pharmacy & Medicine Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock tracking, controlled stock-in/out, and automated 20% low-stock detection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            nativeButton={false}
            render={
              <Link href="/inventory/transactions">
                <History className="h-4 w-4" />
                Ledger / History
              </Link>
            }
          />
          {alerts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-500 text-amber-600 dark:text-amber-400"
              nativeButton={false}
              render={
                <Link href="/inventory/alerts">
                  <AlertTriangle className="h-4 w-4" />
                  Alerts ({alerts.length})
                </Link>
              }
            />
          )}
          {isAdmin && <MedicineFormDialog />}
        </div>
      </div>

      {/* Low-Stock Alert Warning Banner */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                {alerts.length} Medicine{alerts.length > 1 ? "s" : ""} at or below 20% Low-Stock Threshold
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                {alerts.slice(0, 3).map((a) => `${a.item.name} (${a.currentQuantity}/${a.item.referenceStock})`).join(", ")}
                {alerts.length > 3 ? ` and ${alerts.length - 3} more` : ""}
              </p>
            </div>
          </div>
          <Link
            href="/inventory/alerts"
            className="text-xs font-semibold text-amber-900 hover:underline shrink-0 dark:text-amber-300"
          >
            Review & Acknowledge →
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Catalog</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">Managed products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Stock</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{inStockCount}</div>
            <p className="text-xs text-muted-foreground">Optimal levels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock (≤20%)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Needs replenishment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">0 units available</p>
          </CardContent>
        </Card>
      </div>

      <InventoryTable items={items} userRole={user.role} />
    </div>
  )
}
