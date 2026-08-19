"use server"

import { safeRevalidatePath as revalidatePath } from "@/lib/revalidate"
import { addMinutes, isBefore, isToday, parse, startOfDay, endOfDay } from "date-fns"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getCurrentUserOrNull, requireRole } from "@/lib/auth"
import { generateAppointmentCode } from "@/lib/sequence"
import { serializeDecimal } from "@/lib/serialize"
import { logAudit } from "@/lib/audit"
import { NotificationService } from "@/lib/notifications"
import {
  bookAppointmentSchema,
  walkInSchema,
  availabilitySchema,
  waitingListSchema,
  type BookAppointmentInput,
  type WalkInInput,
  type AvailabilityInput,
  type WaitingListInput,
} from "@/lib/validations/appointment"

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "ARRIVED", "IN_CONSULTATION"] as const

// ── Slot computation ───────────────────────────────────────────────────

export async function getAvailableSlots(doctorId: string, date: Date) {
  const dayOfWeek = date.getDay()
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const [availabilities, leave, existingAppointments] = await Promise.all([
    prisma.doctorAvailability.findMany({
      where: { doctorId, dayOfWeek, isActive: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.doctorLeave.findFirst({
      where: { doctorId, date: { gte: dayStart, lte: dayEnd } },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: [...ACTIVE_STATUSES] },
      },
      select: { scheduledAt: true },
    }),
  ])

  if (leave) return { onLeave: true, reason: leave.reason, slots: [] as Date[] }

  const bookedTimes = new Set(existingAppointments.map((a) => a.scheduledAt.getTime()))
  const now = new Date()
  const slots: Date[] = []

  for (const availability of availabilities) {
    const start = parse(availability.startTime, "HH:mm", date)
    const end = parse(availability.endTime, "HH:mm", date)
    let cursor = start
    while (isBefore(cursor, end)) {
      if (!bookedTimes.has(cursor.getTime()) && (!isToday(date) || isBefore(now, cursor))) {
        slots.push(new Date(cursor))
      }
      cursor = addMinutes(cursor, availability.slotDurationMinutes)
    }
  }

  return { onLeave: false, reason: null, slots }
}

// ── Booking / lifecycle ────────────────────────────────────────────────

export async function bookAppointment(input: BookAppointmentInput) {
  const data = bookAppointmentSchema.parse(input)
  const user = await getCurrentUserOrNull()

  // Concurrency-safe atomic transaction
  const appointment = await prisma.$transaction(async (tx) => {
    // Atomic conflict verification inside transaction
    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        scheduledAt: data.scheduledAt,
        status: { in: [...ACTIVE_STATUSES] },
      },
    })
    if (conflict) {
      throw new Error("This slot was just booked. Please choose another slot.")
    }

    const appointmentCode = await generateAppointmentCode(tx)
    const created = await tx.appointment.create({
      data: {
        appointmentCode,
        patientId: data.patientId,
        doctorId: data.doctorId,
        serviceId: data.serviceId || null,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        type: data.type,
        reason: data.reason || null,
        createdById: user?.id ?? null,
        source: user ? "CRM" : "WEBSITE",
      },
      include: {
        patient: true,
        doctor: true,
        service: true,
      },
    })

    await logAudit({
      action: "APPOINTMENT_BOOKED",
      entityType: "Appointment",
      entityId: created.id,
      metadata: {
        appointmentCode: created.appointmentCode,
        doctorId: created.doctorId,
        scheduledAt: created.scheduledAt,
      },
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role,
      tx,
    })

    return created
  })

  // Asynchronously dispatch notifications without blocking response
  NotificationService.notifyAppointmentBooked({
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName || ""}`.trim(),
    patientPhone: appointment.patient.phone,
    patientEmail: appointment.patient.email,
    appointmentCode: appointment.appointmentCode,
    doctorName: appointment.doctor.name,
    serviceName: appointment.service?.name || "Consultation",
    scheduledAt: appointment.scheduledAt,
  }).catch((err) => console.error("[Notification] Booking alert failed:", err))

  revalidatePath("/appointments")
  revalidatePath(`/patients/${data.patientId}`)
  revalidatePath("/dashboard")
  return appointment
}

export async function createWalkIn(input: WalkInInput) {
  const data = walkInSchema.parse(input)
  const user = await getCurrentUser()
  const now = new Date()

  const appointment = await prisma.$transaction(async (tx) => {
    const appointmentCode = await generateAppointmentCode(tx)
    const created = await tx.appointment.create({
      data: {
        appointmentCode,
        patientId: data.patientId,
        doctorId: data.doctorId,
        scheduledAt: now,
        type: "WALK_IN",
        status: "ARRIVED",
        reason: data.reason || null,
        checkedInAt: now,
        createdById: user.id,
        source: "CRM",
      },
    })

    await logAudit({
      action: "APPOINTMENT_BOOKED",
      entityType: "Appointment",
      entityId: created.id,
      metadata: { type: "WALK_IN", appointmentCode: created.appointmentCode },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return created
  })

  revalidatePath("/appointments")
  revalidatePath("/queue")
  revalidatePath(`/patients/${data.patientId}`)
  revalidatePath("/dashboard")
  return appointment
}

export async function cancelAppointment(id: string, reason: string) {
  const user = await getCurrentUser()
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id },
    include: { patient: true, doctor: true, service: true },
  })

  if (user.role === "RECEPTIONIST" && appointment.patient.registrationStatus === "LOCKED_FOR_RECEPTIONIST") {
    throw new Error("This patient's registration and appointment are locked. Only an Admin can cancel.")
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.appointment.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() },
    })

    await logAudit({
      action: "APPOINTMENT_CANCELLED",
      entityType: "Appointment",
      entityId: id,
      metadata: { appointmentCode: appointment.appointmentCode, reason },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return res
  })

  NotificationService.notifyAppointmentStatusChange("CANCELLED", {
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName || ""}`.trim(),
    patientPhone: appointment.patient.phone,
    patientEmail: appointment.patient.email,
    appointmentCode: appointment.appointmentCode,
    doctorName: appointment.doctor.name,
    serviceName: appointment.service?.name || "Consultation",
    scheduledAt: appointment.scheduledAt,
    reason,
  }).catch((err) => console.error("[Notification] Cancel alert failed:", err))

  revalidatePath("/appointments")
  revalidatePath("/queue")
  revalidatePath(`/patients/${appointment.patientId}`)
  revalidatePath("/dashboard")
  return updated
}

export async function rescheduleAppointment(id: string, newScheduledAt: Date) {
  const user = await getCurrentUser()
  const original = await prisma.appointment.findUniqueOrThrow({
    where: { id },
    include: { patient: true, doctor: true, service: true },
  })

  if (user.role === "RECEPTIONIST" && original.patient.registrationStatus === "LOCKED_FOR_RECEPTIONIST") {
    throw new Error("This patient's registration and appointment are locked. Only an Admin can reschedule.")
  }

  const [, next] = await prisma.$transaction(async (tx) => {
    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId: original.doctorId,
        scheduledAt: newScheduledAt,
        status: { in: [...ACTIVE_STATUSES] },
      },
    })
    if (conflict) throw new Error("This slot is already booked. Please choose another slot.")

    const updated = await tx.appointment.update({
      where: { id },
      data: { status: "RESCHEDULED" },
    })
    const appointmentCode = await generateAppointmentCode(tx)
    const created = await tx.appointment.create({
      data: {
        appointmentCode,
        patientId: original.patientId,
        doctorId: original.doctorId,
        serviceId: original.serviceId,
        scheduledAt: newScheduledAt,
        durationMinutes: original.durationMinutes,
        type: original.type,
        reason: original.reason,
        rescheduledFromId: id,
        createdById: original.createdById,
        source: original.source,
      },
    })

    await logAudit({
      action: "APPOINTMENT_RESCHEDULED",
      entityType: "Appointment",
      entityId: created.id,
      metadata: {
        originalAppointmentCode: original.appointmentCode,
        newAppointmentCode: created.appointmentCode,
        newScheduledAt,
      },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return [updated, created]
  })

  NotificationService.notifyAppointmentStatusChange("RESCHEDULED", {
    patientName: `${original.patient.firstName} ${original.patient.lastName || ""}`.trim(),
    patientPhone: original.patient.phone,
    patientEmail: original.patient.email,
    appointmentCode: original.appointmentCode,
    doctorName: original.doctor.name,
    serviceName: original.service?.name || "Consultation",
    scheduledAt: newScheduledAt,
  }).catch((err) => console.error("[Notification] Reschedule alert failed:", err))

  revalidatePath("/appointments")
  revalidatePath(`/patients/${original.patientId}`)
  revalidatePath("/dashboard")
  return next
}

export async function updateAppointmentStatus(id: string, status: (typeof ACTIVE_STATUSES)[number] | "COMPLETED" | "NO_SHOW") {
  const user = await getCurrentUser()
  const now = new Date()
  const data: Record<string, unknown> = { status }
  if (status === "ARRIVED") data.checkedInAt = now
  if (status === "IN_CONSULTATION") data.startedAt = now
  if (status === "COMPLETED") data.completedAt = now

  const appointment = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id },
      data,
      include: { patient: true, doctor: true, service: true },
    })

    await logAudit({
      action: "APPOINTMENT_STATUS_CHANGED",
      entityType: "Appointment",
      entityId: id,
      metadata: { newStatus: status },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return updated
  })

  if (status === "CONFIRMED") {
    NotificationService.notifyAppointmentStatusChange("CONFIRMED", {
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName || ""}`.trim(),
      patientPhone: appointment.patient.phone,
      patientEmail: appointment.patient.email,
      appointmentCode: appointment.appointmentCode,
      doctorName: appointment.doctor.name,
      serviceName: appointment.service?.name || "Consultation",
      scheduledAt: appointment.scheduledAt,
    }).catch((err) => console.error("[Notification] Confirm alert failed:", err))
  }

  revalidatePath("/appointments")
  revalidatePath("/queue")
  revalidatePath(`/patients/${appointment.patientId}`)
  revalidatePath("/dashboard")
  return appointment
}

export async function getAppointments(params: {
  date?: string | Date
  from?: Date
  to?: Date
  doctorId?: string
  status?: string
  type?: string
  query?: string
  page?: number
  pageSize?: number
}) {
  const { date, from, to, doctorId, status, type, query, page = 1, pageSize = 20 } = params

  const where: Record<string, unknown> = {}
  if (doctorId) where.doctorId = doctorId
  if (status) where.status = status
  if (type) where.type = type
  if (from || to) {
    where.scheduledAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    }
  } else if (date) {
    const d = new Date(date)
    where.scheduledAt = { gte: startOfDay(d), lte: endOfDay(d) }
  }
  if (query) {
    where.patient = {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { uhid: { contains: query, mode: "insensitive" } },
      ],
    }
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
        service: true,
      },
      orderBy: { scheduledAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ])

  return {
    appointments: appointments.map((a) => ({
      ...a,
      doctor: serializeDecimal(a.doctor, ["consultationFee"]),
      service: a.service ? serializeDecimal(a.service, ["price"]) : null,
    })),
    total,
    page,
    pageSize,
  }
}

export async function getQueue() {
  const today = new Date()
  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: startOfDay(today), lte: endOfDay(today) },
      status: { in: ["PENDING", "CONFIRMED", "ARRIVED", "IN_CONSULTATION"] },
    },
    include: {
      patient: true,
      doctor: true,
      service: true,
    },
    orderBy: { scheduledAt: "asc" },
  })

  return appointments.map((a) => ({
    ...a,
    doctor: serializeDecimal(a.doctor, ["consultationFee"]),
    service: a.service ? serializeDecimal(a.service, ["price"]) : null,
  }))
}

export const getTodayQueue = getQueue

export async function checkInAppointment(id: string) {
  return updateAppointmentStatus(id, "ARRIVED")
}

export async function startConsultation(id: string) {
  return updateAppointmentStatus(id, "IN_CONSULTATION")
}

export async function completeConsultation(id: string) {
  return updateAppointmentStatus(id, "COMPLETED")
}

export async function markNoShow(id: string) {
  return updateAppointmentStatus(id, "NO_SHOW")
}

// ── Waiting list ───────────────────────────────────────────────────────

export async function addToWaitingList(input: WaitingListInput) {
  const data = waitingListSchema.parse(input)
  const entry = await prisma.waitingListEntry.create({
    data: {
      patientId: data.patientId,
      doctorId: data.doctorId || null,
      requestedDate: data.requestedDate ? new Date(data.requestedDate) : null,
      reason: data.reason || null,
      priority: data.priority,
    },
  })
  revalidatePath("/waiting-list")
  return entry
}

export async function updateWaitingListStatus(id: string, status: "WAITING" | "NOTIFIED" | "CONVERTED" | "EXPIRED") {
  const entry = await prisma.waitingListEntry.update({ where: { id }, data: { status } })
  revalidatePath("/waiting-list")
  return entry
}

export async function deleteWaitingListEntry(id: string) {
  await prisma.waitingListEntry.delete({ where: { id } })
  revalidatePath("/waiting-list")
}

export async function getWaitingList() {
  return prisma.waitingListEntry.findMany({
    where: { status: "WAITING" },
    include: {
      patient: true,
      doctor: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  })
}

// ── Availability management ────────────────────────────────────────────

export async function addAvailability(doctorId: string, input: AvailabilityInput) {
  await requireRole("ADMIN", "DOCTOR")
  const data = availabilitySchema.parse(input)
  const slot = await prisma.doctorAvailability.create({
    data: {
      doctorId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      slotDurationMinutes: data.slotDurationMinutes,
    },
  })
  revalidatePath("/appointments/availability")
  return slot
}

export async function deleteAvailability(id: string) {
  await requireRole("ADMIN", "DOCTOR")
  await prisma.doctorAvailability.delete({ where: { id } })
  revalidatePath("/appointments/availability")
}

export async function getAllDoctorsWithAvailability() {
  const doctors = await prisma.user.findMany({
    where: { role: "DOCTOR", active: true },
    include: {
      doctorAvailabilities: { orderBy: { dayOfWeek: "asc" } },
      doctorLeaves: { orderBy: { date: "desc" } },
    },
    orderBy: { name: "asc" },
  })
  return doctors.map((d) => ({
    ...serializeDecimal(d, ["consultationFee"]),
    doctorAvailabilities: d.doctorAvailabilities,
    doctorLeaves: d.doctorLeaves,
  }))
}

export async function getAppointmentCountsForMonth(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lte: end },
      status: { in: [...ACTIVE_STATUSES, "COMPLETED"] },
    },
    select: { scheduledAt: true },
  })

  const counts: Record<string, number> = {}
  for (const apt of appointments) {
    const d = new Date(apt.scheduledAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export async function setDoctorAvailability(doctorId: string, availabilities: AvailabilityInput[]) {
  await requireRole("ADMIN", "DOCTOR")
  const parsed = availabilities.map((a) => availabilitySchema.parse(a))

  await prisma.$transaction(async (tx) => {
    await tx.doctorAvailability.deleteMany({ where: { doctorId } })
    for (const a of parsed) {
      await tx.doctorAvailability.create({
        data: {
          doctorId,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime,
          slotDurationMinutes: a.slotDurationMinutes,
          isActive: true,
        },
      })
    }
  })

  revalidatePath("/appointments/availability")
}

export async function addDoctorLeave(doctorId: string, date: Date, reason?: string) {
  await requireRole("ADMIN", "DOCTOR")
  const leave = await prisma.doctorLeave.create({
    data: { doctorId, date, reason },
  })
  revalidatePath("/appointments/availability")
  return leave
}

export async function deleteDoctorLeave(id: string) {
  await requireRole("ADMIN", "DOCTOR")
  await prisma.doctorLeave.delete({ where: { id } })
  revalidatePath("/appointments/availability")
}

export async function getDoctorSchedule(doctorId: string) {
  const [availabilities, leaves] = await Promise.all([
    prisma.doctorAvailability.findMany({ where: { doctorId }, orderBy: { dayOfWeek: "asc" } }),
    prisma.doctorLeave.findMany({ where: { doctorId }, orderBy: { date: "desc" } }),
  ])
  return { availabilities, leaves }
}
