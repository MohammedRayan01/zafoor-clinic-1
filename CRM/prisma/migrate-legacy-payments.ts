// One-time migration: the connected Supabase project was previously used by
// an older CRM build that recorded payments in a "PatientPayment" table.
// The current codebase uses Bill/BillItem/Payment instead and has no model
// for PatientPayment at all, so those rows were invisible to this app.
// This copies each PatientPayment row into a matching Bill + Payment so the
// existing billing history shows up correctly. Idempotent — skips rows
// already migrated (billNumber `INV-LEGACY-<id>` already exists).
//
// Run with: npx tsx prisma/migrate-legacy-payments.ts
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

type LegacyPayment = {
  id: string
  patientId: string
  appointmentId: string | null
  amount: number
  paymentMethod: string
  status: "PENDING" | "PAID"
  notes: string | null
  recordedById: string
  verifiedById: string | null
  paidAt: Date | null
  createdAt: Date
}

function mapMethod(m: string): "CASH" | "CARD" | "UPI" | "NET_BANKING" | "INSURANCE" | "ADVANCE" {
  const upper = m.toUpperCase()
  if (["CASH", "CARD", "UPI", "NET_BANKING", "INSURANCE", "ADVANCE"].includes(upper)) return upper as never
  return "CASH"
}

async function main() {
  const legacyRows = await prisma.$queryRawUnsafe<LegacyPayment[]>(
    `select id, "patientId", "appointmentId", amount, "paymentMethod", status, notes, "recordedById", "verifiedById", "paidAt", "createdAt" from "PatientPayment" order by "createdAt" asc`
  )
  console.log(`Found ${legacyRows.length} legacy PatientPayment row(s) to reconcile.`)

  let migrated = 0
  let skipped = 0
  for (const row of legacyRows) {
    const billNumber = `INV-LEGACY-${row.id}`
    const existing = await prisma.bill.findUnique({ where: { billNumber } })
    if (existing) {
      skipped++
      continue
    }

    const isPaid = row.status === "PAID"
    const amountPaid = isPaid ? row.amount : 0

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        patientId: row.patientId,
        appointmentId: row.appointmentId,
        totalAmount: row.amount,
        netAmount: row.amount,
        amountPaid,
        balanceDue: row.amount - amountPaid,
        status: isPaid ? "PAID" : "PENDING",
        issuedAt: row.createdAt,
        items: {
          create: [
            {
              description: row.notes || "Legacy payment (migrated from previous system)",
              quantity: 1,
              unitPrice: row.amount,
              amount: row.amount,
            },
          ],
        },
      },
    })

    if (isPaid && row.paidAt) {
      await prisma.payment.create({
        data: {
          receiptNumber: `RCPT-LEGACY-${row.id}`,
          patientId: row.patientId,
          billId: bill.id,
          amount: row.amount,
          method: mapMethod(row.paymentMethod),
          status: "SUCCESS",
          receivedById: row.recordedById,
          paidAt: row.paidAt,
        },
      })
    }

    migrated++
    console.log(`  Migrated ${row.id} -> ${billNumber} (${row.status}, ₹${row.amount})`)
  }

  console.log(`\nDone. ${migrated} migrated, ${skipped} already present.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
