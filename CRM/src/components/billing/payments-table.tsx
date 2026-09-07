"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { setPatientPaymentStatus, type PatientPaymentRow } from "@/actions/patient-payments"

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
}
const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  PARTIALLY_PAID: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400",
}

export function PaymentsTable({ payments }: { payments: PatientPaymentRow[] }) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false
      if (!q) return true
      const name = `${p.patientFirstName} ${p.patientLastName ?? ""}`.toLowerCase()
      return name.includes(q) || p.patientUhid.toLowerCase().includes(q)
    })
  }, [payments, search, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          items={{ ALL: "All statuses", ...statusLabels }}
          value={status}
          onValueChange={(v) => setStatus(v ?? "ALL")}
        >
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No payments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Bill #</th>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Recorded By</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <PaymentRow key={p.id} payment={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentRow({ payment }: { payment: PatientPaymentRow }) {
  const [pending, startTransition] = useTransition()
  const isPaid = payment.status === "PAID"
  const locked = payment.status === "CANCELLED" || payment.status === "REFUNDED"

  function handleToggle(checked: boolean) {
    const nextStatus = checked ? "PAID" : "PENDING"
    startTransition(async () => {
      try {
        await setPatientPaymentStatus(payment.id, nextStatus)
        toast.success(checked ? "Bill marked as paid" : "Bill reverted to pending")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update payment")
      }
    })
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link href={`/billing/${payment.id}`} className="font-medium hover:underline">
          {payment.billNumber}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Link href={`/patients/${payment.patientId}`} className="font-medium hover:underline">
          {payment.patientFirstName} {payment.patientLastName ?? ""}
        </Link>
        <p className="text-xs text-muted-foreground">{payment.patientUhid}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(payment.createdAt)}</td>
      <td className="px-4 py-3 font-medium">{formatCurrency(payment.amount)}</td>
      <td className="px-4 py-3">{payment.paymentMethod}</td>
      <td className="px-4 py-3 text-muted-foreground">{payment.recordedByName ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary" className={statusColors[payment.status]}>
          {statusLabels[payment.status]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">Mark Paid</span>
          <Checkbox checked={isPaid} disabled={pending || locked} onCheckedChange={handleToggle} />
        </div>
      </td>
    </tr>
  )
}
