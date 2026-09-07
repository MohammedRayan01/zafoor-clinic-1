import { getPatientPayments } from "@/actions/patient-payments"
import { PaymentsTable } from "@/components/billing/payments-table"

export default async function PaymentsPage() {
  const payments = await getPatientPayments()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {payments.length} payment{payments.length === 1 ? "" : "s"} recorded
        </p>
      </div>
      <PaymentsTable payments={payments} />
    </div>
  )
}
