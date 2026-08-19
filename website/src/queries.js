// Raw parameterized SQL against the shared CRM database. Column names are
// exact camelCase (Prisma default — no @map in crm/prisma/schema.prisma),
// so every identifier below is double-quoted.
const { pool } = require("./db")

const DEFAULT_CLINIC_SETTINGS = {
  id: "clinic",
  name: "Zafoor Clinic",
  addressLine:
    "No. 69/70, St. Xavier Street, Broadway, Sevenwells, George Town, Chennai - 600001, Tamil Nadu, India",
  landmark: "Opposite Huda Mosque",
  phone: "8940399403",
  email: "ZafoorClinic@gmail.com",
  mapQuery: "Zafoor Clinic, St. Xavier Street, George Town, Chennai",
  weekdayOpen: "18:00",
  weekdayClose: "22:00",
  sundayClosed: true,
  heroHeadline: "Trusted healthcare for your everyday health.",
  aboutText: null,
}

async function getClinicSettings() {
  const { rows } = await pool.query(`SELECT * FROM "ClinicSettings" WHERE id = 'clinic' LIMIT 1`)
  return rows[0] || DEFAULT_CLINIC_SETTINGS
}

async function getActiveServices() {
  const { rows } = await pool.query(
    `SELECT * FROM "Service" WHERE active = true ORDER BY "displayOrder" ASC, name ASC`
  )
  return rows
}

async function getServiceBySlug(slug) {
  const { rows } = await pool.query(`SELECT * FROM "Service" WHERE slug = $1 AND active = true LIMIT 1`, [slug])
  return rows[0] || null
}

async function getActiveFaqs() {
  const { rows } = await pool.query(
    `SELECT * FROM "FAQ" WHERE active = true ORDER BY "displayOrder" ASC, "createdAt" ASC`
  )
  return rows
}

async function getPublishedReviews() {
  const { rows } = await pool.query(`
    SELECT r.*, s.name AS "serviceName"
    FROM "Review" r
    LEFT JOIN "Service" s ON s.id = r."serviceId"
    WHERE r.published = true
    ORDER BY r."displayOrder" ASC, r."createdAt" DESC
  `)
  return rows
}

async function getActiveDoctors() {
  const { rows } = await pool.query(
    `SELECT id, name, specialization FROM "User" WHERE role = 'DOCTOR' AND active = true ORDER BY name ASC`
  )
  return rows
}

/** Weekly recurring availability rows + one-off leave dates for a doctor. */
async function getDoctorAvailability(doctorId) {
  const [avail, leave] = await Promise.all([
    pool.query(
      `SELECT * FROM "DoctorAvailability" WHERE "doctorId" = $1 AND "isActive" = true ORDER BY "dayOfWeek" ASC, "startTime" ASC`,
      [doctorId]
    ),
    pool.query(`SELECT date FROM "DoctorLeave" WHERE "doctorId" = $1 AND date >= CURRENT_DATE`, [doctorId]),
  ])
  return { availability: avail.rows, leaveDates: leave.rows.map((r) => r.date) }
}

/** Booked/held slot timestamps for a doctor on a given calendar day. */
async function getBookedSlots(doctorId, dayStart, dayEnd) {
  const { rows } = await pool.query(
    `SELECT "scheduledAt" FROM "Appointment"
     WHERE "doctorId" = $1 AND "scheduledAt" >= $2 AND "scheduledAt" <= $3
       AND status IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION')`,
    [doctorId, dayStart, dayEnd]
  )
  return rows.map((r) => r.scheduledAt.getTime())
}

async function nextCounterValue(client, key) {
  const { rows } = await client.query(
    `INSERT INTO "Counter" (key, value) VALUES ($1, 1)
     ON CONFLICT (key) DO UPDATE SET value = "Counter".value + 1
     RETURNING value`,
    [key]
  )
  return rows[0].value
}

async function generateUHID(client) {
  const year = new Date().getFullYear()
  const value = await nextCounterValue(client, `UHID-${year}`)
  return `ZC-${year}-${String(value).padStart(6, "0")}`
}

async function generateAppointmentCode(client) {
  const year = new Date().getFullYear()
  const value = await nextCounterValue(client, `APPOINTMENT-${year}`)
  return `APT-${year}-${String(value).padStart(6, "0")}`
}

/**
 * Books a website appointment: matches an existing patient by phone (the
 * clinic's dedup key) or creates a new one, then inserts the Appointment
 * row. Runs in a transaction with a re-check for slot conflicts so two
 * simultaneous bookings can't double-book the same slot.
 */
async function bookWebsiteAppointment({ doctorId, serviceId, scheduledAt, durationMinutes, reason, patient }) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const conflict = await client.query(
      `SELECT id FROM "Appointment"
       WHERE "doctorId" = $1 AND "scheduledAt" = $2
         AND status IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION')
       LIMIT 1`,
      [doctorId, scheduledAt]
    )
    if (conflict.rows.length > 0) {
      throw Object.assign(new Error("This slot was just booked. Please choose another slot."), { code: "SLOT_TAKEN" })
    }

    let patientId
    const existing = await client.query(`SELECT id FROM "Patient" WHERE phone = $1 LIMIT 1`, [patient.phone])
    if (existing.rows.length > 0) {
      patientId = existing.rows[0].id
    } else {
      const uhid = await generateUHID(client)
      const patientIdGen = `pt_${uhid.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
      const inserted = await client.query(
        `INSERT INTO "Patient"
           (id, uhid, "firstName", "lastName", gender, phone, email, source, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'WEBSITE', now(), now())
         RETURNING id`,
        [patientIdGen, uhid, patient.firstName, patient.lastName || null, patient.gender || null, patient.phone, patient.email || null]
      )
      patientId = inserted.rows[0].id
      await client.query(
        `INSERT INTO "CommunicationPreference" (id, "patientId", "preferredChannel", "updatedAt")
         VALUES ($1, $2, 'SMS', now())`,
        [`cp_${patientIdGen}`, patientId]
      )
    }

    const appointmentCode = await generateAppointmentCode(client)
    const appointmentId = `apt_${appointmentCode.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
    await client.query(
      `INSERT INTO "Appointment"
         (id, "appointmentCode", "patientId", "doctorId", "serviceId", "scheduledAt", "durationMinutes",
          type, status, source, reason, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PERSON', 'PENDING', 'WEBSITE', $8, now())`,
      [appointmentId, appointmentCode, patientId, doctorId, serviceId || null, scheduledAt, durationMinutes || 30, reason || null]
    )

    await client.query("COMMIT")
    return { appointmentCode, patientId }
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

async function saveContactMessage({ name, email, phone, message, subject }) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    let patientId
    let existing
    if (phone) {
      existing = await client.query(`SELECT id FROM "Patient" WHERE phone = $1 LIMIT 1`, [phone])
    } else if (email) {
      existing = await client.query(`SELECT id FROM "Patient" WHERE email = $1 LIMIT 1`, [email])
    }

    if (existing && existing.rows.length > 0) {
      patientId = existing.rows[0].id
    } else {
      const uhid = await generateUHID(client)
      const patientIdGen = `pt_${uhid.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}`
      const nameParts = (name || "Website Visitor").trim().split(" ")
      const firstName = nameParts[0] || "Website"
      const lastName = nameParts.slice(1).join(" ") || null
      const contactPhone = phone || `INQ-${Date.now().toString().slice(-8)}`

      const inserted = await client.query(
        `INSERT INTO "Patient"
           (id, uhid, "firstName", "lastName", phone, email, source, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, 'WEBSITE_CONTACT', now(), now())
         RETURNING id`,
        [patientIdGen, uhid, firstName, lastName, contactPhone, email || null]
      )
      patientId = inserted.rows[0].id
      await client.query(
        `INSERT INTO "CommunicationPreference" (id, "patientId", "preferredChannel", "updatedAt")
         VALUES ($1, $2, 'EMAIL', now())`,
        [`cp_${patientIdGen}`, patientId]
      )
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    await client.query(
      `INSERT INTO "Message"
         (id, "patientId", channel, direction, subject, body, status, "sentAt")
       VALUES ($1, $2, 'EMAIL', 'INBOUND', $3, $4, 'DELIVERED', now())`,
      [messageId, patientId, subject || "Website Inquiry", message]
    )

    await client.query("COMMIT")
    return { success: true, patientId, messageId }
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

module.exports = {
  getClinicSettings,
  getActiveServices,
  getServiceBySlug,
  getActiveFaqs,
  getPublishedReviews,
  getActiveDoctors,
  getDoctorAvailability,
  getBookedSlots,
  bookWebsiteAppointment,
  saveContactMessage,
}
