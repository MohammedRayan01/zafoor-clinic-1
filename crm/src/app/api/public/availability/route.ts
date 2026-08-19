import { prisma } from "@/lib/prisma"
import { error, getAvailableSlots, json, preflight } from "../_lib"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** GET /api/public/availability?doctorId=&date=YYYY-MM-DD */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const doctorId = searchParams.get("doctorId")?.trim()
  const dateParam = searchParams.get("date")?.trim()

  if (!doctorId) return error(request, "doctorId is required", 400)
  if (!dateParam) return error(request, "date is required", 400)
  if (!DATE_RE.test(dateParam)) return error(request, "date must be in YYYY-MM-DD format", 400)

  // Parsed as local time so slot generation matches the clinic's timezone.
  const [y, m, d] = dateParam.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return error(request, "date is invalid", 400)

  const doctor = await prisma.user.findFirst({
    where: { id: doctorId, role: "DOCTOR", active: true },
    select: { id: true },
  })
  if (!doctor) return error(request, "Doctor not found", 400)

  const { onLeave, reason, slots } = await getAvailableSlots(doctorId, date)

  return json(request, {
    onLeave,
    reason: reason ?? null,
    slots: slots.map((s) => s.toISOString()),
  })
}

export async function OPTIONS(request: Request) {
  return preflight(request)
}
