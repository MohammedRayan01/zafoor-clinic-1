import { z } from "zod"

export const appointmentTypeEnum = z.enum(["IN_PERSON", "WALK_IN"])

export const bookAppointmentSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().min(1, "Select a doctor"),
  serviceId: z.string().optional(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().default(30),
  type: appointmentTypeEnum.default("IN_PERSON"),
  reason: z.string().trim().optional(),
})
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>

export const walkInSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().min(1, "Select a doctor"),
  reason: z.string().trim().optional(),
})
export type WalkInInput = z.infer<typeof walkInSchema>

export const rescheduleSchema = z.object({
  scheduledAt: z.coerce.date(),
})

export const cancelSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required"),
})

export const availabilitySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  slotDurationMinutes: z.coerce.number().int().positive().default(30),
})
export type AvailabilityInput = z.infer<typeof availabilitySchema>

export const waitingListSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  doctorId: z.string().optional(),
  requestedDate: z.coerce.date().optional().nullable(),
  reason: z.string().trim().optional(),
  priority: z.coerce.number().int().default(0),
  bpSystolic: z.number().int().positive("Required"),
  bpDiastolic: z.number().int().positive("Required"),
  heightCm: z.number().positive("Required"),
  weightKg: z.number().positive("Required"),
  temperatureC: z.number().positive("Required"),
})
export type WaitingListInput = z.infer<typeof waitingListSchema>
