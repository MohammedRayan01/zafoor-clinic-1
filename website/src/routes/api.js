const express = require("express")
const { getActiveDoctors, getActiveServices, bookWebsiteAppointment, saveContactMessage } = require("../queries")
const { getAvailableSlots } = require("../slots")

const router = express.Router()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PHONE_RE = /^[0-9+\-\s]{7,15}$/
const EMAIL_RE = /^\S+@\S+\.\S+$/

// GET /api/availability?doctorId=...&date=YYYY-MM-DD
router.get("/availability", async (req, res) => {
  try {
    const { doctorId, date } = req.query
    if (!doctorId || !date || !DATE_RE.test(date)) {
      return res.status(400).json({ error: "doctorId and a date (YYYY-MM-DD) are required" })
    }
    const requested = new Date(`${date}T00:00:00`)
    if (Number.isNaN(requested.getTime())) return res.status(400).json({ error: "Invalid date" })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (requested < today) return res.json({ onLeave: false, slots: [] })

    const result = await getAvailableSlots(doctorId, date)
    res.json({ onLeave: result.onLeave, slots: result.slots.map((s) => s.toISOString()) })
  } catch (err) {
    console.error("[api/availability]", err)
    res.status(500).json({ error: "Could not load availability" })
  }
})

// GET /api/doctors — for the booking step 2 doctor picker (auto-assign if only one)
router.get("/doctors", async (_req, res) => {
  try {
    res.json(await getActiveDoctors())
  } catch (err) {
    console.error("[api/doctors]", err)
    res.status(500).json({ error: "Could not load doctors" })
  }
})

// POST /api/appointments — create a booking
router.post("/appointments", async (req, res) => {
  try {
    const body = req.body || {}
    const errors = {}

    const firstName = String(body.firstName || "").trim()
    const phone = String(body.phone || "").trim()
    const email = String(body.email || "").trim()
    const gender = String(body.gender || "").trim().toUpperCase()
    const serviceId = String(body.serviceId || "").trim()
    const doctorId = String(body.doctorId || "").trim()
    const scheduledAt = String(body.scheduledAt || "").trim()
    const reason = String(body.reason || "").trim()

    if (!firstName) errors.firstName = "Full name is required"
    if (!PHONE_RE.test(phone)) errors.phone = "Enter a valid phone number"
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email"
    if (!serviceId) errors.serviceId = "Select a service"
    if (!doctorId) errors.doctorId = "Select a doctor"
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) errors.scheduledAt = "Select a valid time slot"
    if (gender && !["MALE", "FEMALE", "OTHER"].includes(gender)) errors.gender = "Invalid gender"

    const services = await getActiveServices()
    const service = services.find((s) => s.id === serviceId)
    if (!service) errors.serviceId = "That service is no longer available"

    const doctors = await getActiveDoctors()
    const doctor = doctors.find((d) => d.id === doctorId)
    if (!doctor) errors.doctorId = "That doctor is no longer available"

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", fields: errors })
    }

    const result = await bookWebsiteAppointment({
      doctorId,
      serviceId,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: service.durationMinutes,
      reason,
      patient: { firstName, lastName: String(body.lastName || "").trim(), phone, email, gender: gender || null },
    })

    console.log(
      `\n📨 [WEBSITE BOOKING NOTIFICATION]\n` +
      `Patient: ${firstName} (${phone})\n` +
      `Booking ID: ${result.appointmentCode}\n` +
      `Doctor: Dr. ${doctor.name}\n` +
      `Service: ${service.name}\n` +
      `Scheduled: ${new Date(scheduledAt).toLocaleString("en-IN")}\n` +
      `--------------------------------------------------\n`
    )

    res.status(201).json({
      appointmentCode: result.appointmentCode,
      service: service.name,
      doctor: doctor.name,
      scheduledAt,
    })
  } catch (err) {
    if (err.code === "SLOT_TAKEN") {
      return res.status(409).json({ error: err.message })
    }
    console.error("[api/appointments]", err)
    res.status(500).json({ error: "Could not create appointment. Please try again or call the clinic." })
  }
})

// POST /api/contact — persist website inquiries directly into CRM Message table
router.post("/contact", async (req, res) => {
  try {
    const body = req.body || {}
    const errors = {}

    const name = String(body.name || "").trim()
    const email = String(body.email || "").trim()
    const phone = String(body.phone || "").trim()
    const subject = String(body.subject || "Website Contact Form Inquiry").trim()
    const message = String(body.message || "").trim()

    if (!name) errors.name = "Your name is required"
    if (!message) errors.message = "Message cannot be empty"
    if (!email && !phone) {
      errors.email = "Please provide an email or phone number so we can respond"
    } else {
      if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address"
      if (phone && !PHONE_RE.test(phone)) errors.phone = "Enter a valid phone number"
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", fields: errors })
    }

    await saveContactMessage({ name, email, phone, message, subject })

    res.status(201).json({
      success: true,
      message: "Thank you for reaching out! Your message has been sent to our clinic staff.",
    })
  } catch (err) {
    console.error("[api/contact]", err)
    res.status(500).json({ error: "Could not send your message. Please try again or call the clinic directly." })
  }
})

module.exports = router
