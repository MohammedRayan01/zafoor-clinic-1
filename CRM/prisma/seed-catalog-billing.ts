// Aligns Service pricing and InventoryItem stock with Zafoor Clinic's real
// service lines (Skin/Hair/Laser, Diabetology, General Medicine — see
// zafoorclinic.com), then creates a batch of itemized bills (consultation +
// dispensed medicine) so Billing/Refunds/Finance/Cash-counter have realistic
// variety. Idempotent: upserts by unique key, safe to re-run.
//
// Run with: npx tsx prisma/seed-catalog-billing.ts
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 150 * (i + 1)))
    }
  }
  throw lastErr
}

// ── Real clinic services (zafoorclinic.com) with realistic INR pricing ─────
// seed-services.ts wrote these via the anon/publishable key over PostgREST,
// which RLS silently rejected (insert "succeeded" per its logs but rows never
// landed — verified against the DB directly). Upserting via Prisma here
// bypasses RLS and actually persists them.
const serviceDefs: Array<{ slug: string; name: string; shortDescription: string; displayOrder: number; price: number }> = [
  // Skin, Hair & Laser
  { slug: "prp-therapy", name: "PRP Therapy", shortDescription: "Platelet-Rich Plasma treatment for skin rejuvenation and hair regrowth.", displayOrder: 1, price: 3500 },
  { slug: "gfc-therapy", name: "GFC Therapy", shortDescription: "Growth Factor Concentrate treatment for advanced hair and skin restoration.", displayOrder: 2, price: 4500 },
  { slug: "chemical-peels", name: "Chemical Peels", shortDescription: "Resurfacing treatment for tone, texture and pigmentation correction.", displayOrder: 3, price: 2000 },
  { slug: "skin-boosters", name: "Skin Boosters", shortDescription: "Hydration-based injectables for smoother, plumper skin.", displayOrder: 4, price: 5000 },
  { slug: "laser-treatments", name: "Laser Treatments", shortDescription: "Scar removal, tattoo removal, hair reduction and pigmentation removal.", displayOrder: 5, price: 3000 },
  { slug: "facials", name: "Facials", shortDescription: "Includes Hydra Facial and Fire & Ice Facial for glow and rejuvenation.", displayOrder: 6, price: 1800 },
  { slug: "open-pores-treatment", name: "Open Pores Treatment", shortDescription: "Targeted therapy to minimise enlarged pores.", displayOrder: 7, price: 1500 },
  { slug: "melasma-pigmentation", name: "Melasma / Pigmentation", shortDescription: "Dedicated treatment for melasma and pigmentation concerns.", displayOrder: 8, price: 2500 },
  { slug: "tanning-treatment", name: "Tanning Treatment", shortDescription: "De-tan therapy to restore natural skin tone.", displayOrder: 9, price: 1200 },
  { slug: "acne-pimples-treatment", name: "Acne / Pimples Treatment", shortDescription: "Clinical treatment to control breakouts and reduce scarring.", displayOrder: 10, price: 1500 },
  { slug: "wart-corn-removal", name: "Wart & Corn Removal", shortDescription: "Safe, minimally invasive removal procedures.", displayOrder: 11, price: 1000 },
  { slug: "hairfall-dandruff-treatment", name: "Hairfall & Dandruff Treatment", shortDescription: "Scalp therapies to control hair fall and dandruff.", displayOrder: 12, price: 1800 },
  { slug: "weight-reduction", name: "Weight Reduction", shortDescription: "Structured weight-loss treatment plans.", displayOrder: 13, price: 2500 },
  // Diabetology
  { slug: "vitals-monitoring", name: "Vitals Monitoring", shortDescription: "Routine vitals check as part of every diabetes visit.", displayOrder: 14, price: 300 },
  { slug: "complication-checklist", name: "Complication Checklist", shortDescription: "Systematic screening for diabetes-related complications.", displayOrder: 15, price: 800 },
  { slug: "diabetic-foot-care", name: "Diabetic Foot Care", shortDescription: "Dedicated assessment and treatment for diabetic foot complications.", displayOrder: 16, price: 1200 },
  { slug: "neuropathy-screening", name: "Neuropathy Screening", shortDescription: "Monofilament and vibration testing to catch diabetic nerve damage early.", displayOrder: 17, price: 900 },
  // General Medicine
  { slug: "thyroid-care", name: "Thyroid Care", shortDescription: "Diagnosis and ongoing management of thyroid conditions.", displayOrder: 18, price: 600 },
  { slug: "hypertension-management", name: "Hypertension Management", shortDescription: "Ongoing blood pressure monitoring and a tailored treatment plan.", displayOrder: 19, price: 500 },
  { slug: "cholesterol-management", name: "Cholesterol Management", shortDescription: "Screening and treatment plans for cholesterol control.", displayOrder: 20, price: 600 },
  { slug: "pediatrics", name: "Pediatrics", shortDescription: "Children's health and general care treatments.", displayOrder: 21, price: 500 },
  { slug: "gynaecology", name: "Gynaecology", shortDescription: "Women's health care treatments and consultations.", displayOrder: 22, price: 700 },
  { slug: "ent-care", name: "ENT Care", shortDescription: "Ear, nose and throat treatments for all ages.", displayOrder: 23, price: 500 },
  { slug: "eye-care", name: "Eye Care", shortDescription: "General eye care consultations and treatment.", displayOrder: 24, price: 500 },
]
const servicePrices: Record<string, number> = Object.fromEntries(serviceDefs.map((s) => [s.slug, s.price]))
const legacySlugs = [
  "hairfall-review", "acne-review", "thyroid-review", "skin-review",
  "diabetes-review", "general-review", "skin-diabetes-general-review",
]

// ── Expanded medicine/consumable catalog across all four specialties ───────
const inventoryDefs = [
  // Existing 7 (from base seed) are left untouched; these are additions.
  { sku: "MED-ISO-20", name: "Isotretinoin 20mg Capsules", category: "Capsule", manufacturer: "Cipla", unit: "Strip of 10", currentStock: 18, referenceStock: 30, unitPrice: 320 },
  { sku: "MED-MIN-5", name: "Minoxidil 5% Topical Solution", category: "Topical / Cream", manufacturer: "Mankind", unit: "Bottle 60ml", currentStock: 25, referenceStock: 40, unitPrice: 450 },
  { sku: "MED-FIN-1", name: "Finasteride 1mg Tablets", category: "Tablet", manufacturer: "Sun Pharma", unit: "Strip of 10", currentStock: 30, referenceStock: 40, unitPrice: 180 },
  { sku: "MED-HYA-SB", name: "Hyaluronic Acid Skin Booster Vial", category: "Injectable", manufacturer: "Teoxane", unit: "Vial 2ml", currentStock: 10, referenceStock: 20, unitPrice: 4200 },
  { sku: "MED-PRP-KIT", name: "PRP Extraction Kit", category: "Consumable", manufacturer: "Regenlab", unit: "Kit", currentStock: 15, referenceStock: 25, unitPrice: 1800 },
  { sku: "MED-NUM-CR", name: "Lidocaine Numbing Cream 5%", category: "Topical / Cream", manufacturer: "Emla", unit: "Tube 30g", currentStock: 20, referenceStock: 30, unitPrice: 320 },
  { sku: "MED-HYDR-SR", name: "Hydrafacial Serum Set", category: "Consumable", manufacturer: "Hydrafacial", unit: "Set", currentStock: 8, referenceStock: 15, unitPrice: 2500 },
  { sku: "MED-SUN-SPF", name: "Sunscreen SPF 50+ (Clinic Use)", category: "Topical / Cream", manufacturer: "La Roche-Posay", unit: "Tube 50ml", currentStock: 24, referenceStock: 30, unitPrice: 650 },
  { sku: "MED-INS-GLA", name: "Insulin Glargine Injection", category: "Injectable", manufacturer: "Sanofi", unit: "Pen 3ml", currentStock: 12, referenceStock: 20, unitPrice: 550 },
  { sku: "MED-GLU-STR", name: "Glucometer Test Strips (Box of 25)", category: "Consumable", manufacturer: "Accu-Chek", unit: "Box", currentStock: 20, referenceStock: 30, unitPrice: 480 },
  { sku: "MED-GLI-1", name: "Glimepiride 1mg Tablets", category: "Tablet", manufacturer: "USV", unit: "Strip of 10", currentStock: 40, referenceStock: 50, unitPrice: 45 },
  { sku: "MED-VIT-D3", name: "Vitamin D3 60K Sachets", category: "Sachet", manufacturer: "Mankind", unit: "Sachet", currentStock: 50, referenceStock: 60, unitPrice: 30 },
  { sku: "MED-THY-50", name: "Thyroxine 50mcg Tablets", category: "Tablet", manufacturer: "Abbott", unit: "Strip of 10", currentStock: 35, referenceStock: 45, unitPrice: 90 },
  { sku: "MED-AML-5", name: "Amlodipine 5mg Tablets", category: "Tablet", manufacturer: "Cipla", unit: "Strip of 10", currentStock: 45, referenceStock: 50, unitPrice: 55 },
  { sku: "MED-ATO-10", name: "Atorvastatin 10mg Tablets", category: "Tablet", manufacturer: "Zydus", unit: "Strip of 10", currentStock: 38, referenceStock: 45, unitPrice: 70 },
  { sku: "MED-PAN-40", name: "Pantoprazole 40mg Tablets", category: "Tablet", manufacturer: "Sun Pharma", unit: "Strip of 10", currentStock: 42, referenceStock: 50, unitPrice: 65 },
  { sku: "MED-ORS-SAC", name: "ORS Rehydration Sachets", category: "Sachet", manufacturer: "FDC", unit: "Sachet", currentStock: 60, referenceStock: 70, unitPrice: 15 },
  { sku: "MED-GLOVES", name: "Nitrile Examination Gloves (Box of 100)", category: "Consumable", manufacturer: "Ansell", unit: "Box", currentStock: 15, referenceStock: 25, unitPrice: 380 },
  { sku: "MED-SYR-5", name: "Disposable Syringe 5ml", category: "Consumable", manufacturer: "BD", unit: "Box of 100", currentStock: 10, referenceStock: 20, unitPrice: 420 },
]

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function main() {
  console.log("Upserting the 24 real clinic services (Skin/Hair/Laser, Diabetology, General Medicine)…")
  for (const s of serviceDefs) {
    await withRetry(() =>
      prisma.service.upsert({
        where: { slug: s.slug },
        create: { slug: s.slug, name: s.name, shortDescription: s.shortDescription, displayOrder: s.displayOrder, price: s.price, active: true },
        update: { name: s.name, shortDescription: s.shortDescription, displayOrder: s.displayOrder, price: s.price, active: true },
      })
    )
  }
  await withRetry(() => prisma.service.updateMany({ where: { slug: { in: legacySlugs } }, data: { active: false } }))
  console.log(`  ${serviceDefs.length} real services upserted, ${legacySlugs.length} legacy generic services deactivated`)

  console.log("Adding expanded medicine/consumable inventory…")
  const admin = await withRetry(() => prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }))
  let created = 0
  const items = []
  for (const def of inventoryDefs) {
    const existing = await withRetry(() => prisma.inventoryItem.findUnique({ where: { sku: def.sku } }))
    if (existing) {
      items.push(existing)
      continue
    }
    const item = await withRetry(() =>
      prisma.inventoryItem.create({
        data: {
          sku: def.sku,
          name: def.name,
          category: def.category,
          manufacturer: def.manufacturer,
          unit: def.unit,
          currentStock: def.currentStock,
          referenceStock: def.referenceStock,
          unitPrice: def.unitPrice,
        },
      })
    )
    await withRetry(() =>
      prisma.inventoryTransaction.create({
        data: {
          itemId: item.id,
          type: "STOCK_IN",
          quantity: def.currentStock,
          previousStock: 0,
          newStock: def.currentStock,
          reason: "Initial stock — catalog seed",
          performedById: admin.id,
        },
      })
    )
    items.push(item)
    created++
  }
  console.log(`  ${created} new inventory items created (${inventoryDefs.length - created} already existed)`)

  console.log("Creating itemized bills (consultation + dispensed medicine)…")
  const patients = await withRetry(() => prisma.patient.findMany({ take: 12, orderBy: { createdAt: "asc" } }))
  const doctor = await withRetry(() => prisma.user.findFirstOrThrow({ where: { role: "DOCTOR" } }))
  const receptionist = await withRetry(() => prisma.user.findFirstOrThrow({ where: { role: "RECEPTIONIST" } }))
  const services = await withRetry(() => prisma.service.findMany({ where: { slug: { in: Object.keys(servicePrices) } } }))
  const serviceBySlug = Object.fromEntries(services.map((s) => [s.slug, s]))
  const medBySku = Object.fromEntries(items.map((i) => [i.sku, i]))

  const billPlans = [
    { slug: "hairfall-dandruff-treatment", meds: ["MED-MIN-5", "MED-FIN-1"], status: "PAID" as const },
    { slug: "prp-therapy", meds: ["MED-PRP-KIT", "MED-NUM-CR"], status: "PAID" as const },
    { slug: "acne-pimples-treatment", meds: ["MED-ISO-20"], status: "PARTIALLY_PAID" as const },
    { slug: "melasma-pigmentation", meds: ["MED-SUN-SPF"], status: "PAID" as const },
    { slug: "facials", meds: ["MED-HYDR-SR"], status: "PAID" as const },
    { slug: "skin-boosters", meds: ["MED-HYA-SB"], status: "PENDING" as const },
    { slug: "diabetic-foot-care", meds: ["MED-INS-GLA", "MED-GLU-STR", "MED-GLI-1"], status: "PAID" as const },
    { slug: "vitals-monitoring", meds: ["MED-GLU-STR"], status: "PAID" as const },
    { slug: "thyroid-care", meds: ["MED-THY-50"], status: "PAID" as const },
    { slug: "hypertension-management", meds: ["MED-AML-5"], status: "PAID" as const },
    { slug: "cholesterol-management", meds: ["MED-ATO-10"], status: "PARTIALLY_PAID" as const },
    { slug: "ent-care", meds: ["MED-ORS-SAC"], status: "CANCELLED" as const },
  ]

  const existingBillCount = await withRetry(() =>
    prisma.bill.count({ where: { billNumber: { startsWith: "INV-CAT-" } } })
  )
  if (existingBillCount > 0) {
    console.log(`  Skipping — ${existingBillCount} catalog bills already exist (idempotent).`)
  } else {
    let billCount = 0
    let paymentCount = 0
    for (const [i, plan] of billPlans.entries()) {
      const patient = patients[i % patients.length]
      const service = serviceBySlug[plan.slug]
      if (!patient || !service) continue

      const servicePrice = Number(service.price ?? 0)
      const medItems = plan.meds
        .map((sku) => medBySku[sku])
        .filter(Boolean)
        .map((m) => ({
          description: m!.name,
          quantity: 1,
          unitPrice: Number(m!.unitPrice ?? 0),
          amount: Number(m!.unitPrice ?? 0),
        }))
      const medTotal = medItems.reduce((sum, m) => sum + m.amount, 0)
      const total = servicePrice + medTotal
      const discount = i === 5 ? Math.round(total * 0.1) : 0
      const net = total - discount
      const paid =
        plan.status === "PAID" ? net : plan.status === "PARTIALLY_PAID" ? Math.round(net / 2) : plan.status === "CANCELLED" ? 0 : 0

      const bill = await withRetry(() =>
        prisma.bill.create({
          data: {
            billNumber: `INV-CAT-${String(i + 1).padStart(4, "0")}`,
            patientId: patient.id,
            serviceId: service.id,
            totalAmount: total,
            discountAmount: discount,
            netAmount: net,
            amountPaid: paid,
            balanceDue: net - paid,
            status: plan.status,
            issuedAt: daysAgo(billPlans.length - i),
            cancelledAt: plan.status === "CANCELLED" ? daysAgo(billPlans.length - i) : null,
            items: {
              create: [
                { description: `${service.name} consultation`, quantity: 1, unitPrice: servicePrice, amount: servicePrice },
                ...medItems,
              ],
            },
          },
        })
      )
      billCount++

      if (paid > 0) {
        await withRetry(() =>
          prisma.payment.create({
            data: {
              receiptNumber: `RCPT-CAT-${String(i + 1).padStart(4, "0")}`,
              patientId: patient.id,
              billId: bill.id,
              amount: paid,
              method: (["CASH", "UPI", "CARD"] as const)[i % 3],
              status: "SUCCESS",
              receivedById: receptionist.id,
              paidAt: daysAgo(billPlans.length - i),
            },
          })
        )
        paymentCount++
      }
    }
    console.log(`  ${billCount} itemized bills created, ${paymentCount} payments recorded`)
  }

  console.log("\nCatalog + billing seed complete.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
