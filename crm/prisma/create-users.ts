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
  console.log("=========================================================")
  console.log(" Zafoor Clinic CRM — Admin & Receptionist Account Setup")
  console.log("=========================================================\n")

  const accounts = [
    // Primary / Production Logins
    {
      name: "Clinic Administrator",
      email: "admin@zafoorclinic.com",
      phone: "8940399403",
      password: "Admin@123456",
      role: "ADMIN" as const,
    },
    {
      name: "Front Desk Receptionist",
      email: "reception@zafoorclinic.com",
      phone: "8940399403",
      password: "Reception@123456",
      role: "RECEPTIONIST" as const,
    },
    // Standard Demo / Test Logins
    {
      name: "Demo Admin",
      email: "admin@zafoorclinic.test",
      phone: "8940399403",
      password: "ChangeMe123!",
      role: "ADMIN" as const,
    },
    {
      name: "Demo Receptionist",
      email: "reception@zafoorclinic.test",
      phone: "8940399403",
      password: "ChangeMe123!",
      role: "RECEPTIONIST" as const,
    },
  ]

  for (const account of accounts) {
    const passwordHash = hashPassword(account.password)
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        phone: account.phone,
        passwordHash,
        role: account.role,
        active: true,
      },
      create: {
        name: account.name,
        email: account.email,
        phone: account.phone,
        passwordHash,
        role: account.role,
        active: true,
      },
    })

    console.log(`✅ [${account.role}] ${account.name}`)
    console.log(`   📧 Email:    ${account.email}`)
    console.log(`   🔑 Password: ${account.password}`)
    console.log(`   🆔 User ID:  ${user.id}\n`)
  }

  console.log("✨ All login accounts created / verified successfully!")
}

main()
  .catch((err) => {
    console.error("❌ Error setting up accounts:", err.message || err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
