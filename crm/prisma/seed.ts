// Zafoor Clinic — demo/seed data.
// Idempotent seed script to initialize demo staff, services, availability,
// reviews, FAQs, settings, inventory catalog, alerts, and sample patients.
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { scryptSync, randomBytes } from "node:crypto"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

async function main() {
  console.log("Seeding Zafoor Clinic demo data…")

  // ── Staff ────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@zafoorclinic.test" },
    update: {
      name: "Clinic Admin",
      phone: "8940399403",
      passwordHash: hashPassword("ChangeMe123!"),
      role: "ADMIN",
      active: true,
    },
    create: {
      name: "Clinic Admin",
      email: "admin@zafoorclinic.test",
      phone: "8940399403",
      passwordHash: hashPassword("ChangeMe123!"),
      role: "ADMIN",
      active: true,
    },
  })

  // Production/Standard Admin
  await prisma.user.upsert({
    where: { email: "admin@zafoorclinic.com" },
    update: {
      name: "Clinic Administrator",
      phone: "8940399403",
      passwordHash: hashPassword("Admin@123456"),
      role: "ADMIN",
      active: true,
    },
    create: {
      name: "Clinic Administrator",
      email: "admin@zafoorclinic.com",
      phone: "8940399403",
      passwordHash: hashPassword("Admin@123456"),
      role: "ADMIN",
      active: true,
    },
  })

  const doctor = await prisma.user.upsert({
    where: { email: "doctor@zafoorclinic.test" },
    update: {
      name: "Dr. Mufeeda Roohi",
      phone: "8940399403",
      passwordHash: hashPassword("ChangeMe123!"),
      role: "DOCTOR",
      specialization: "Aesthetic Physician, Diabetologist & Family Physician",
      consultationFee: 500,
      active: true,
    },
    create: {
      name: "Dr. Mufeeda Roohi",
      email: "doctor@zafoorclinic.test",
      phone: "8940399403",
      passwordHash: hashPassword("ChangeMe123!"),
      role: "DOCTOR",
      specialization: "Aesthetic Physician, Diabetologist & Family Physician",
      consultationFee: 500,
      active: true,
    },
  })

  const receptionist = await prisma.user.upsert({
    where: { email: "reception@zafoorclinic.test" },
    update: {
      name: "Front Desk",
      phone: "8940399403",
      passwordHash: hashPassword("ChangeMe123!"),
      role: "RECEPTIONIST",
      active: true,
    },
    create: {
      name: "Front Desk",
      email: "reception@zafoorclinic.test",
      phone: "8940399403",
      passwordHash: hashPassword("ChangeMe123!"),
      role: "RECEPTIONIST",
      active: true,
    },
  })

  // Production/Standard Receptionist
  await prisma.user.upsert({
    where: { email: "reception@zafoorclinic.com" },
    update: {
      name: "Front Desk Receptionist",
      phone: "8940399403",
      passwordHash: hashPassword("Reception@123456"),
      role: "RECEPTIONIST",
      active: true,
    },
    create: {
      name: "Front Desk Receptionist",
      email: "reception@zafoorclinic.com",
      phone: "8940399403",
      passwordHash: hashPassword("Reception@123456"),
      role: "RECEPTIONIST",
      active: true,
    },
  })

  console.log(`  Staff accounts ready: Admin, Doctor, Receptionist`)

  // ── Doctor availability — Mon-Sat 6:00 PM - 10:00 PM, Sunday closed ──
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: doctor.id } })
  for (let day = 1; day <= 6; day++) {
    await prisma.doctorAvailability.create({
      data: { doctorId: doctor.id, dayOfWeek: day, startTime: "18:00", endTime: "22:00", slotDurationMinutes: 30 },
    })
  }
  console.log("  Doctor availability set (Mon-Sat 6-10 PM)")

  // ── Services — the clinic's review types ────────────────────────────
  const serviceDefs = [
    { slug: "hairfall-review", name: "Hairfall Review", shortDescription: "Consultation for hair loss and scalp concerns." },
    { slug: "acne-review", name: "Acne Review", shortDescription: "Consultation for acne and breakouts." },
    { slug: "thyroid-review", name: "Thyroid Review", shortDescription: "Consultation for thyroid-related concerns." },
    { slug: "skin-review", name: "Skin Review", shortDescription: "General skin consultation." },
    { slug: "diabetes-review", name: "Diabetes Review", shortDescription: "Consultation for diabetes management." },
    { slug: "general-review", name: "General Review", shortDescription: "General health consultation." },
    { slug: "skin-diabetes-general-review", name: "Skin, Diabetes & General Review", shortDescription: "Combined consultation covering skin, diabetes, and general health." },
  ]
  const services = []
  for (const [i, def] of serviceDefs.entries()) {
    const s = await prisma.service.upsert({
      where: { slug: def.slug },
      update: { name: def.name, shortDescription: def.shortDescription, durationMinutes: 30, displayOrder: i, active: true },
      create: { ...def, durationMinutes: 30, displayOrder: i, active: true },
    })
    services.push(s)
  }
  console.log(`  ${services.length} services ready`)

  // ── Inventory Medicines & 20% Low-Stock Detection ────────────────────
  const medicineDefs = [
    {
      name: "Benadryl Cough Syrup 100ml",
      sku: "MED-BEN-100",
      category: "Syrup",
      manufacturer: "Johnson & Johnson",
      unit: "Bottle",
      description: "Cough and cold relief syrup for allergic and dry cough.",
      referenceStock: 20,
      lowStockThresholdPercent: 20,
      currentStock: 20, // Threshold = 4 (Normal)
      unitPrice: 115.0,
    },
    {
      name: "Paracetamol 500mg Tablets",
      sku: "MED-PCM-500",
      category: "Tablet",
      manufacturer: "GSK",
      unit: "Strip",
      description: "Antipyretic and analgesic for fever and pain.",
      referenceStock: 50,
      lowStockThresholdPercent: 20,
      currentStock: 45, // Threshold = 10 (Normal)
      unitPrice: 35.0,
    },
    {
      name: "Amoxicillin 500mg Capsules",
      sku: "MED-AMX-500",
      category: "Capsule",
      manufacturer: "Cipla",
      unit: "Strip",
      description: "Broad spectrum antibiotic for bacterial infections.",
      referenceStock: 30,
      lowStockThresholdPercent: 20,
      currentStock: 4, // Threshold = 6 (Low Stock Alert Active!)
      unitPrice: 85.0,
    },
    {
      name: "Adapalene Gel 0.1%",
      sku: "MED-ADP-01",
      category: "Topical / Cream",
      manufacturer: "Galderma",
      unit: "Tube",
      description: "Topical retinoid for acne vulgaris treatment.",
      referenceStock: 15,
      lowStockThresholdPercent: 20,
      currentStock: 12, // Threshold = 3 (Normal)
      unitPrice: 280.0,
    },
    {
      name: "Cetirizine 10mg Tablets",
      sku: "MED-CTZ-10",
      category: "Tablet",
      manufacturer: "Dr. Reddy's",
      unit: "Strip",
      description: "Antihistamine for allergic rhinitis and skin allergies.",
      referenceStock: 40,
      lowStockThresholdPercent: 20,
      currentStock: 0, // Threshold = 8 (Out of Stock Critical Alert!)
      unitPrice: 42.0,
    },
    {
      name: "Metformin 500mg Tablets",
      sku: "MED-MET-500",
      category: "Tablet",
      manufacturer: "USV",
      unit: "Strip",
      description: "Oral antidiabetic medication for glycemic control.",
      referenceStock: 60,
      lowStockThresholdPercent: 20,
      currentStock: 55, // Threshold = 12 (Normal)
      unitPrice: 60.0,
    },
    {
      name: "Biotin & Zinc Hair Supplement",
      sku: "MED-BIO-50",
      category: "Supplements",
      manufacturer: "Himalaya",
      unit: "Bottle",
      description: "Nutritional supplement for hair growth and scalp health.",
      referenceStock: 25,
      lowStockThresholdPercent: 20,
      currentStock: 22, // Threshold = 5 (Normal)
      unitPrice: 350.0,
    },
  ]

  for (const med of medicineDefs) {
    const thresholdQty = Math.max(1, Math.floor(med.referenceStock * (med.lowStockThresholdPercent / 100)))
    const item = await prisma.inventoryItem.upsert({
      where: { sku: med.sku },
      update: {
        name: med.name,
        category: med.category,
        manufacturer: med.manufacturer,
        unit: med.unit,
        description: med.description,
        referenceStock: med.referenceStock,
        lowStockThresholdPercent: med.lowStockThresholdPercent,
        lowStockThresholdQty: thresholdQty,
        currentStock: med.currentStock,
        unitPrice: med.unitPrice,
        active: true,
      },
      create: {
        name: med.name,
        sku: med.sku,
        category: med.category,
        manufacturer: med.manufacturer,
        unit: med.unit,
        description: med.description,
        referenceStock: med.referenceStock,
        lowStockThresholdPercent: med.lowStockThresholdPercent,
        lowStockThresholdQty: thresholdQty,
        currentStock: med.currentStock,
        unitPrice: med.unitPrice,
        active: true,
      },
    })

    // Seed alert if stock is low or out
    if (med.currentStock <= thresholdQty) {
      const existingAlert = await prisma.inventoryAlert.findFirst({
        where: { itemId: item.id, status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      })
      if (!existingAlert) {
        await prisma.inventoryAlert.create({
          data: {
            itemId: item.id,
            alertType: "LOW_STOCK",
            severity: med.currentStock === 0 ? "CRITICAL" : "HIGH",
            currentQuantity: med.currentStock,
            thresholdQuantity: thresholdQty,
            status: "ACTIVE",
          },
        })
      }
    }
  }
  console.log(`  ${medicineDefs.length} inventory medicines & low-stock alerts initialized`)

  // ── Reviews — real patient reviews ──────────────────────────────────
  await prisma.review.deleteMany()
  const reviewDefs = [
    {
      patientName: "Abdul Khadar",
      rating: 5,
      comment:
        "I came here for diabetic treatment, Dr Roohi guided me very well and clearly explained diet control, and also provided a diet chart, I followed only 2 weeks, My sugar level came 92/112 From 193/293, thank you Dr❤️",
      serviceSlug: "diabetes-review",
    },
    {
      patientName: "omar ali",
      rating: 5,
      comment:
        "Dr.Mufeeda Roohi diagnosing the patient well getting the medical records perfectly and starting the treatment. The treatment is periodically step by step to cure the patient according to their satisfaction. The clinic aim is to educate the patients of their disease and after the cure post control advice to refine throughout rest of their life. The clinic is very clean and hygienic. One is getting good tips of lifestyle and food habits to over come problems related to their disease. Masha Allah.",
      serviceSlug: "diabetes-review",
    },
    {
      patientName: "Sneha Vuppala",
      rating: 5,
      comment:
        "I came here for a cosmetic treatment and doctor guided me very well and explained the procedure very patiently the staff there also kind the clinic was pleasant and also treatments where affordable.",
      serviceSlug: "skin-review",
    },
    {
      patientName: "Aaliya Parvin",
      rating: 5,
      comment:
        "I had a great experience with Dr. Mufeeda. She quickly identified the root cause of my hair fall and explained the issue very clearly. Her approach to treatment was precise and to the point, without unnecessary medications or procedures. I started noticing positive results much sooner than I expected. I truly appreciate her efficiency, professionalism, and the care she showed throughout the process. Highly recommended for anyone dealing with hair fall concerns",
      serviceSlug: "hairfall-review",
    },
    {
      patientName: "Monica subbu",
      rating: 5,
      comment: "I have done hydra facial here\nVery satisfying\nCost efficient",
      serviceSlug: "skin-review",
    },
    {
      patientName: "Ponmozhi Narayanan",
      rating: 5,
      comment: "One of the best clinic in Sevenwells, Dr.Mufeeda Roohi is kind with patient. Good to visit Dr.Mufeeda for all the problems",
      serviceSlug: "general-review",
    },
  ]
  for (const [i, def] of reviewDefs.entries()) {
    const service = services.find((s) => s.slug === def.serviceSlug)
    await prisma.review.create({
      data: {
        patientName: def.patientName,
        rating: def.rating,
        comment: def.comment,
        serviceId: service ? service.id : null,
        published: true,
        displayOrder: i,
      },
    })
  }
  console.log(`  ${reviewDefs.length} real patient reviews seeded (published)`)

  // ── Clinic settings (website content) ───────────────────────────────
  await prisma.clinicSettings.upsert({
    where: { id: "clinic" },
    create: { id: "clinic" },
    update: {},
  })
  console.log("  Clinic settings initialized")

  // ── FAQs ─────────────────────────────────────────────────────────────
  await prisma.fAQ.deleteMany()
  const faqDefs = [
    { question: "What are your clinic timings?", answer: "We are open Monday to Saturday, 6:00 PM to 10:00 PM. We are closed on Sundays." },
    { question: "Do I need to book an appointment in advance?", answer: "Yes, booking in advance through our website or by phone helps us reduce your waiting time." },
    { question: "Where is Zafoor Clinic located?", answer: "No. 69/70, St. Xavier Street, Broadway, Sevenwells, George Town, Chennai - 600001, opposite Huda Mosque." },
    { question: "How can I contact the clinic?", answer: "You can call us at 8940399403 or email ZafoorClinic@gmail.com." },
  ]
  for (const [i, def] of faqDefs.entries()) {
    await prisma.fAQ.create({ data: { ...def, displayOrder: i } })
  }
  console.log(`  ${faqDefs.length} FAQs created`)

  console.log("\n=======================================================")
  console.log(" ✨ Database Seeding Complete!")
  console.log("=======================================================")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
