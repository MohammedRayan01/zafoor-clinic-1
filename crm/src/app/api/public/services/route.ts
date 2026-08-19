import { prisma } from "@/lib/prisma"
import { json, preflight } from "../_lib"

export const dynamic = "force-dynamic"

/** GET /api/public/services — active services for the public website. */
export async function GET(request: Request) {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      shortDescription: true,
      price: true,
      durationMinutes: true,
    },
  })

  return json(
    request,
    services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? s.shortDescription ?? null,
      price: s.price == null ? null : Number(s.price),
      durationMinutes: s.durationMinutes,
    }))
  )
}

export async function OPTIONS(request: Request) {
  return preflight(request)
}
