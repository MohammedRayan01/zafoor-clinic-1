import Link from "next/link"
import { ShieldAlert, FileText, Filter } from "lucide-react"
import { format } from "date-fns"
import { requireRole } from "@/lib/auth"
import { getAuditLogs } from "@/actions/audit"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; query?: string }>
}) {
  await requireRole("ADMIN")
  const params = await searchParams
  const { logs, total } = await getAuditLogs(params)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Immutable security and operational trail of all clinic activities ({total} total events).
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <ShieldAlert className="h-3.5 w-3.5" />
          Admin Audited
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Activity Stream</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5">Performed By</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isOverride = log.action.includes("OVERRIDE")
                    const isDelete = log.action.includes("DELETED")
                    const isAlert = log.action.includes("ALERT")

                    return (
                      <tr key={log.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), "dd MMM yyyy, HH:mm:ss")}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={
                              isOverride
                                ? "text-purple-600 border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-xs font-mono"
                                : isDelete
                                ? "text-destructive border-destructive text-xs font-mono"
                                : isAlert
                                ? "text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-xs font-mono"
                                : "text-xs font-mono"
                            }
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium">
                          <span className="text-muted-foreground">{log.entityType}:</span>{" "}
                          <span className="font-mono text-foreground">{log.entityId ? log.entityId.slice(-8) : "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <span className="font-medium text-foreground">{log.userName || "System"}</span>{" "}
                          <span className="text-muted-foreground">({log.userRole})</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground max-w-xs truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : "—"}
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
