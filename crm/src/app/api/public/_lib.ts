/**
 * Shared helpers for the public (unauthenticated) website API under
 * `/api/public/*`. Files prefixed with `_` are not route files, so this
 * module never becomes an endpoint itself.
 */
import { NextResponse } from "next/server"
import { addMinutes, endOfDay, isBefore, isToday, parse, startOfDay } from "date-fns"
import { prisma } from "@/lib/prisma"

/** Appointment statuses that still occupy a doctor's slot. */
export const ACTIVE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_CONSULTATION",
] as const

/**
 * Origins allowed to call the public API. `PUBLIC_SITE_ORIGIN` (comma
 * separated) extends the list so production can be configured without a
 * code change. No blanket `*` — credentials may be sent by the site.
 */
export const ALLOWED_ORIGINS: readonly string[] = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.PUBLIC_SITE_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
]

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin")
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  }
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Credentials"] = "true"
  } else {
    // Non-browser callers (curl, server-to-server) send no Origin; echo the
    // canonical site origin so responses are still explicit rather than `*`.
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0]
  }
  return headers
}

/** JSON response carrying the CORS headers for this request's origin. */
export function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) })
}

/** `{ error }` JSON response. */
export function error(request: Request, message: string, status: number, extra?: Record<string, unknown>) {
  return json(request, { error: message, ...extra }, status)
}

/** Shared CORS preflight handler — 204 with the Access-Control-* headers. */
export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

/**
 * Plain (non-"use server") replica of `getAvailableSlots` from
 * `src/actions/appointments.ts` — same behaviour: honours the doctor's
 * weekly availability rows, returns early when the doctor is on leave,
 * excludes already-booked slots and, for today, slots already in the past.
 */
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
