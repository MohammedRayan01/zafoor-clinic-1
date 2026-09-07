import { prisma } from "@/lib/prisma"
import { json, preflight } from "../_lib"

export const dynamic = "force-dynamic"

/** GET /api/public/services — active services for the public website. */
function getDepartmentId(name: string): string {
  const s = name.toLowerCase()
  if (s.includes("skin, diabetes") || s.includes("combined")) return "all-departments"
  if (
    s.includes("skin") ||
    s.includes("hair") ||
    s.includes("acne") ||
    s.includes("laser") ||
    s.includes("prp") ||
    s.includes("gfc") ||
    s.includes("peel") ||
    s.includes("facial") ||
    s.includes("derma") ||
    s.includes("cosmetic") ||
    s.includes("aesthetic")
  ) {
    return "skin-hair-laser"
  }
  if (
    s.includes("diabet") ||
    s.includes("sugar") ||
    s.includes("glucose") ||
    s.includes("insulin") ||
    s.includes("neuropathy") ||
    s.includes("foot")
  ) {
    return "diabetology"
  }
  return "general"
}

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
      departmentId: getDepartmentId(s.name),
    })),
    200,
    300 // catalog rarely changes — safe to serve up to 5 min stale at the edge
  )
}

export async function OPTIONS(request: Request) {
  return preflight(request)
}
