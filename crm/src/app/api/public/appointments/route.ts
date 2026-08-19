import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { generateAppointmentCode, generateUHID } from "@/lib/sequence"
import { ACTIVE_STATUSES, error, json, preflight } from "../_lib"

export const dynamic = "force-dynamic"

const INDIAN_MOBILE = /^(?:\+?91)?[6-9]\d{9}$/

const SLOT_TAKEN = "This slot was just booked. Please choose another slot."

const bookingSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => INDIAN_MOBILE.test(v.replace(/[\s-]/g, "")), "Enter a valid 10-digit Indian mobile number"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], "Gender must be MALE, FEMALE or OTHER").optional(),
  serviceId: z.string().trim().min(1, "Service is required"),
  doctorId: z.string().trim().min(1, "Doctor is required"),
  scheduledAt: z
    .string()
    .trim()
    .min(1, "Appointment time is required")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Appointment time is invalid")
    .refine((v) => new Date(v).getTime() > Date.now(), "Appointment time must be in the future"),
  reason: z.string().trim().optional(),
  durationMinutes: z.number().int().positive().optional(),
})

/** Normalise "+919876543210" / "91 98765 43210" to the bare 10 digits. */
function normalisePhone(raw: string) {
  const digits = raw.replace(/\D/g, "")
  return digits.length > 10 ? digits.slice(-10) : digits
}

/** POST /api/public/appointments — public website booking. */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error(request, "Validation failed", 400, { fields: { body: "Request body must be valid JSON" } })
  }

  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "body")
      if (!fields[key]) fields[key] = issue.message
    }
    return error(request, "Validation failed", 400, { fields })
  }

  const data = parsed.data
  const scheduledAt = new Date(data.scheduledAt)
  const phone = normalisePhone(data.phone)

  const [service, doctor] = await Promise.all([
    prisma.service.findFirst({
      where: { id: data.serviceId, active: true },
      select: { id: true, name: true, durationMinutes: true },
    }),
    prisma.user.findFirst({
      where: { id: data.doctorId, role: "DOCTOR", active: true },
      select: { id: true, name: true },
    }),
  ])

  if (!service || !doctor) {
    const fields: Record<string, string> = {}
    if (!service) fields.serviceId = "Selected service is not available"
    if (!doctor) fields.doctorId = "Selected doctor is not available"
    return error(request, "Validation failed", 400, { fields })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          scheduledAt,
          status: { in: [...ACTIVE_STATUSES] },
        },
        select: { id: true },
      })
      if (conflict) throw new Error(SLOT_TAKEN)

      let patient = await tx.patient.findFirst({
        where: { phone },
        select: { id: true, uhid: true },
      })

      if (!patient) {
        const uhid = await generateUHID(tx)
        patient = await tx.patient.create({
          data: {
            uhid,
            firstName: data.firstName,
            lastName: data.lastName || null,
            phone,
            email: data.email || null,
            gender: data.gender ?? null,
            source: "WEBSITE",
            communicationPreference: {
              create: { preferredChannel: "SMS" },
            },
          },
          select: { id: true, uhid: true },
        })
      }

      const appointmentCode = await generateAppointmentCode(tx)
      const appointment = await tx.appointment.create({
        data: {
          appointmentCode,
          patientId: patient.id,
          doctorId: doctor.id,
          serviceId: service.id,
          scheduledAt,
          durationMinutes: data.durationMinutes ?? service.durationMinutes ?? 30,
          type: "IN_PERSON",
          status: "PENDING",
          source: "WEBSITE",
          reason: data.reason || null,
        },
        select: { appointmentCode: true, scheduledAt: true },
      })

      return { appointment, patientUhid: patient.uhid }
    })

    return json(
      request,
      {
        appointmentCode: result.appointment.appointmentCode,
        patientUhid: result.patientUhid,
        service: service.name,
        doctor: doctor.name,
        scheduledAt: result.appointment.scheduledAt.toISOString(),
      },
      201
    )
  } catch (e) {
    if (e instanceof Error && e.message === SLOT_TAKEN) {
      return error(request, SLOT_TAKEN, 409)
    }
    console.error("[public/appointments] booking failed", e)
    return error(request, "Could not create the appointment. Please try again.", 500)
  }
}

export async function OPTIONS(request: Request) {
  return preflight(request)
}
