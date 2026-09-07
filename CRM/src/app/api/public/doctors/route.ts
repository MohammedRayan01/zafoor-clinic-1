import { prisma } from "@/lib/prisma"
import { json, preflight } from "../_lib"

export const dynamic = "force-dynamic"

/** GET /api/public/doctors — active staff with the DOCTOR role. */
export async function GET(request: Request) {
  const doctors = await prisma.user.findMany({
    where: { role: "DOCTOR", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, specialization: true },
  })

  return json(request, doctors, 200, 300) // staff roster rarely changes — safe to serve up to 5 min stale at the edge
}

export async function OPTIONS(request: Request) {
  return preflight(request)
}
