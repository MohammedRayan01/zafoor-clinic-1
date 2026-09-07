"use server"

import { revalidatePath, updateTag, unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { serializeDecimal } from "@/lib/serialize"
import { serviceSchema, type ServiceInput } from "@/lib/validations/billing"

// The service catalog barely ever changes but is re-fetched from Supabase on
// nearly every appointment/billing page render — cache it across requests
// (invalidated explicitly by the mutations below via updateTag) instead
// of hitting Postgres every time.
const getCachedServices = unstable_cache(
  async (activeOnly: boolean) => {
    const services = await prisma.service.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    })
    return services.map((s) => serializeDecimal(s, ["price"]))
  },
  ["services-list"],
  { tags: ["services"], revalidate: 300 }
)

export async function getServices(activeOnly = false) {
  return getCachedServices(activeOnly)
}

export async function getServiceBySlug(slug: string) {
  const service = await prisma.service.findUnique({ where: { slug } })
  return service ? serializeDecimal(service, ["price"]) : null
}

export async function createService(input: ServiceInput) {
  await requireRole("ADMIN")
  const data = serviceSchema.parse(input)
  const service = await prisma.service.create({ data })
  revalidatePath("/services")
  updateTag("services")
  return serializeDecimal(service, ["price"])
}

export async function updateService(id: string, input: ServiceInput) {
  await requireRole("ADMIN")
  const data = serviceSchema.parse(input)
  const service = await prisma.service.update({ where: { id }, data })
  revalidatePath("/services")
  updateTag("services")
  return serializeDecimal(service, ["price"])
}

export async function toggleServiceActive(id: string, active: boolean) {
  await requireRole("ADMIN")
  await prisma.service.update({ where: { id }, data: { active } })
  revalidatePath("/services")
  updateTag("services")
}

export async function deleteService(id: string) {
  await requireRole("ADMIN")
  await prisma.service.delete({ where: { id } })
  revalidatePath("/services")
  updateTag("services")
}
