import Link from "next/link"
import { ArrowLeft, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react"
import { format } from "date-fns"
import { getCurrentUser } from "@/lib/auth"
import { getInventoryAlerts } from "@/actions/inventory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertActionButtons } from "@/components/inventory/alert-action-buttons"

export default async function InventoryAlertsPage() {
  const user = await getCurrentUser()
  const alerts = await getInventoryAlerts({ status: "ALL" })

  const activeAlerts = alerts.filter((a) => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED")
  const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED")

  const isAdmin = user.role === "ADMIN"

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Low-Stock Alerts</h1>
            <p className="text-sm text-muted-foreground">
              Automated 20% threshold triggers with single active alert deduplication.
            </p>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      <Card className="border-amber-200 dark:border-amber-900/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base font-semibold">Active & Acknowledged Alerts ({activeAlerts.length})</CardTitle>
            </div>
            <Badge variant="outline" className="text-amber-600 border-amber-500 text-xs">
              Requires Replenishment
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="px-4 py-2.5">Medicine</th>
                  <th className="px-4 py-2.5">Current Stock</th>
                  <th className="px-4 py-2.5">Threshold Level</th>
                  <th className="px-4 py-2.5">Suggested Restock</th>
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Last Triggered</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      All medicine stocks are healthy and above their 20% thresholds!
                    </td>
                  </tr>
                ) : (
                  activeAlerts.map((alert) => {
                    const suggestedRestock = Math.max(1, alert.item.referenceStock - alert.currentQuantity)

                    return (
                      <tr key={alert.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/inventory/${alert.itemId}`} className="hover:underline">
                            {alert.item.name}
                          </Link>
                          <span className="block text-xs font-mono text-muted-foreground">{alert.item.sku}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-destructive tabular-nums">
                          {alert.currentQuantity} {alert.item.unit}s
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                          ≤ {alert.thresholdQuantity} {alert.item.unit}s ({alert.item.lowStockThresholdPercent}% of {alert.item.referenceStock})
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{suggestedRestock} {alert.item.unit}s
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={alert.severity === "CRITICAL" ? "destructive" : "secondary"} className="text-xs">
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              alert.status === "ACTIVE"
                                ? "text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-xs"
                                : "text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-xs"
                            }
                          >
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(alert.updatedAt), "dd MMM, HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <AlertActionButtons alert={alert} isAdmin={isAdmin} />
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

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base font-semibold">Resolved Alert Log ({resolvedAlerts.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="px-4 py-2.5">Medicine</th>
                    <th className="px-4 py-2.5">Threshold</th>
                    <th className="px-4 py-2.5">Resolution</th>
                    <th className="px-4 py-2.5">Resolved At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resolvedAlerts.slice(0, 10).map((alert) => (
                    <tr key={alert.id} className="text-muted-foreground hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <Link href={`/inventory/${alert.itemId}`} className="hover:underline">
                          {alert.item.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs">≤ {alert.thresholdQuantity} {alert.item.unit}s</td>
                      <td className="px-4 py-2.5 text-xs">{alert.notes || "Auto-resolved when restocked"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        {alert.resolvedAt ? format(new Date(alert.resolvedAt), "dd MMM yyyy, HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
