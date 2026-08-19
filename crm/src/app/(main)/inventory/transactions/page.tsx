import Link from "next/link"
import { ArrowLeft, History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { format } from "date-fns"
import { getInventoryTransactions } from "@/actions/inventory"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default async function InventoryTransactionsPage() {
  const { transactions, total } = await getInventoryTransactions({ pageSize: 100 })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
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
            <h1 className="text-2xl font-bold tracking-tight">Inventory Movement Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Append-only immutable record of all stock-in and stock-out events ({total} total movements).
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Stock Movements</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Medicine</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Quantity</th>
                  <th className="px-4 py-2.5">Balance</th>
                  <th className="px-4 py-2.5">Reason / Patient</th>
                  <th className="px-4 py-2.5">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isPlus = tx.type === "STOCK_IN"
                    return (
                      <tr key={tx.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {format(new Date(tx.timestamp), "dd MMM yyyy, HH:mm")}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          <Link href={`/inventory/${tx.item.id}`} className="hover:underline text-foreground">
                            {tx.item.name}
                          </Link>
                          <span className="block text-xs font-mono text-muted-foreground">{tx.item.sku}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={isPlus ? "outline" : "secondary"}
                            className={
                              isPlus
                                ? "gap-1 text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-xs"
                                : "gap-1 text-amber-700 bg-amber-100 dark:bg-amber-950/40 text-xs"
                            }
                          >
                            {isPlus ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
                            {tx.type.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 font-bold tabular-nums">
                          <span className={isPlus ? "text-emerald-600" : "text-amber-600"}>
                            {isPlus ? `+${tx.quantity}` : `-${tx.quantity}`} {tx.item.unit}s
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                          {tx.previousStock} → <strong className="text-foreground">{tx.newStock}</strong>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span>{tx.reason || "—"}</span>
                          {tx.patient && (
                            <Link href={`/patients/${tx.patient.id}`} className="block text-[11px] text-primary hover:underline">
                              Patient: {tx.patient.firstName} {tx.patient.lastName || ""}
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
