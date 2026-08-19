"use server"

import { safeRevalidatePath as revalidatePath } from "@/lib/revalidate"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, requireRole } from "@/lib/auth"
import { generateUHID, generateAppointmentCode } from "@/lib/sequence"
import { serializeDecimal } from "@/lib/serialize"
import { logAudit } from "@/lib/audit"
import {
  patientCoreSchema,
  familyMemberSchema,
  insuranceSchema,
  emergencyContactSchema,
  medicalAlertSchema,
  allergySchema,
  chronicDiseaseSchema,
  communicationPreferenceSchema,
  documentSchema,
  type PatientCoreInput,
  type FamilyMemberInput,
  type InsuranceInput,
  type EmergencyContactInput,
  type MedicalAlertInput,
  type AllergyInput,
  type ChronicDiseaseInput,
  type CommunicationPreferenceInput,
  type DocumentInput,
} from "@/lib/validations/patient"

function cleanEmail(email?: string) {
  return email && email.length > 0 ? email : undefined
}

function parseDob(dob?: string) {
  return dob ? new Date(dob) : null
}

export async function createPatient(input: PatientCoreInput) {
  const data = patientCoreSchema.parse(input)
  const user = await getCurrentUser()

  const initialStatus = user.role === "RECEPTIONIST" ? "LOCKED_FOR_RECEPTIONIST" : "CONFIRMED"

  const patient = await prisma.$transaction(async (tx) => {
    const uhid = await generateUHID(tx)
    const newPatient = await tx.patient.create({
      data: {
        uhid,
        firstName: data.firstName,
        lastName: data.lastName || null,
        dob: parseDob(data.dob),
        gender: data.gender,
        bloodGroup: data.bloodGroup ?? "UNKNOWN",
        occupation: data.occupation || null,
        phone: data.phone,
        alternatePhone: data.alternatePhone || null,
        email: cleanEmail(data.email),
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        country: data.country || "India",
        photoUrl: data.photoUrl || null,
        registeredById: user.id,
        registrationStatus: initialStatus,
        lockedAt: initialStatus === "LOCKED_FOR_RECEPTIONIST" ? new Date() : null,
        lockedById: initialStatus === "LOCKED_FOR_RECEPTIONIST" ? user.id : null,
        communicationPreference: {
          create: {
            preferredChannel: "SMS",
          },
        },
      },
    })

    await logAudit({
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: newPatient.id,
      metadata: { uhid: newPatient.uhid, name: `${newPatient.firstName} ${newPatient.lastName || ""}`.trim(), status: initialStatus },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return newPatient
  })

  revalidatePath("/patients")
  return patient
}

/**
 * Atomic registration + booking for receptionist workflow.
 * Registers patient, reserves appointment slot, and locks record for receptionist in one transaction.
 */
export async function registerPatientWithBooking(params: {
  patient: PatientCoreInput
  appointment?: {
    doctorId: string
    serviceId?: string
    scheduledAt: Date
    durationMinutes?: number
    reason?: string
  }
}) {
  const data = patientCoreSchema.parse(params.patient)
  const user = await getCurrentUser()

  const result = await prisma.$transaction(async (tx) => {
    const uhid = await generateUHID(tx)
    const patient = await tx.patient.create({
      data: {
        uhid,
        firstName: data.firstName,
        lastName: data.lastName || null,
        dob: parseDob(data.dob),
        gender: data.gender,
        bloodGroup: data.bloodGroup ?? "UNKNOWN",
        occupation: data.occupation || null,
        phone: data.phone,
        alternatePhone: data.alternatePhone || null,
        email: cleanEmail(data.email),
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        country: data.country || "India",
        photoUrl: data.photoUrl || null,
        registeredById: user.id,
        registrationStatus: "LOCKED_FOR_RECEPTIONIST",
        lockedAt: new Date(),
        lockedById: user.id,
        communicationPreference: {
          create: {
            preferredChannel: "SMS",
          },
        },
      },
    })

    let appointment = null
    if (params.appointment) {
      // Check slot conflict inside transaction
      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: params.appointment.doctorId,
          scheduledAt: params.appointment.scheduledAt,
          status: { in: ["PENDING", "CONFIRMED", "ARRIVED", "IN_CONSULTATION"] },
        },
      })
      if (conflict) {
        throw new Error("The selected appointment slot was just booked. Please choose another slot.")
      }

      const appointmentCode = await generateAppointmentCode(tx)
      appointment = await tx.appointment.create({
        data: {
          appointmentCode,
          patientId: patient.id,
          doctorId: params.appointment.doctorId,
          serviceId: params.appointment.serviceId || null,
          scheduledAt: params.appointment.scheduledAt,
          durationMinutes: params.appointment.durationMinutes || 15,
          type: "IN_PERSON",
          status: "CONFIRMED",
          reason: params.appointment.reason || "Initial registration consultation",
          createdById: user.id,
          source: "CRM",
        },
      })
    }

    await logAudit({
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: patient.id,
      metadata: {
        uhid: patient.uhid,
        lockedForReceptionist: true,
        appointmentId: appointment?.id,
        appointmentCode: appointment?.appointmentCode,
      },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return { patient, appointment }
  })

  revalidatePath("/patients")
  revalidatePath("/appointments")
  revalidatePath("/queue")
  return result
}

export async function updatePatientCore(patientId: string, input: PatientCoreInput) {
  const data = patientCoreSchema.parse(input)
  const user = await getCurrentUser()

  const existing = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!existing) throw new Error("Patient not found")

  // Critical Server-Side Locking: Receptionist cannot edit confirmed/locked registrations
  if (user.role === "RECEPTIONIST" && existing.registrationStatus === "LOCKED_FOR_RECEPTIONIST") {
    throw new Error("This patient registration is confirmed and locked. Only an Admin can make modifications.")
  }

  const patient = await prisma.$transaction(async (tx) => {
    const updated = await tx.patient.update({
      where: { id: patientId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        dob: parseDob(data.dob),
        gender: data.gender,
        bloodGroup: data.bloodGroup ?? "UNKNOWN",
        occupation: data.occupation || null,
        phone: data.phone,
        alternatePhone: data.alternatePhone || null,
        email: cleanEmail(data.email),
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        country: data.country || "India",
        photoUrl: data.photoUrl || null,
      },
    })

    const isOverride = user.role === "ADMIN" && existing.registrationStatus === "LOCKED_FOR_RECEPTIONIST"
    await logAudit({
      action: isOverride ? "PATIENT_OVERRIDE" : "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: patientId,
      metadata: {
        uhid: existing.uhid,
        isAdminOverride: isOverride,
        changes: { firstName: data.firstName, phone: data.phone },
      },
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      tx,
    })

    return updated
  })

  revalidatePath(`/patients/${patientId}`)
  revalidatePath("/patients")
  return patient
}

export async function adminUnlockPatient(patientId: string) {
  const user = await requireRole("ADMIN")
  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: {
      registrationStatus: "CONFIRMED",
      lockedAt: null,
      lockedById: null,
    },
  })

  await logAudit({
    action: "PERMISSION_OVERRIDE",
    entityType: "Patient",
    entityId: patientId,
    metadata: { unlockedBy: user.name, previousStatus: "LOCKED_FOR_RECEPTIONIST" },
  })

  revalidatePath(`/patients/${patientId}`)
  return patient
}

export async function adminLockPatient(patientId: string) {
  const user = await requireRole("ADMIN")
  const patient = await prisma.patient.update({
    where: { id: patientId },
    data: {
      registrationStatus: "LOCKED_FOR_RECEPTIONIST",
      lockedAt: new Date(),
      lockedById: user.id,
    },
  })

  await logAudit({
    action: "PATIENT_LOCKED",
    entityType: "Patient",
    entityId: patientId,
    metadata: { lockedBy: user.name },
  })

  revalidatePath(`/patients/${patientId}`)
  return patient
}

export async function deletePatient(patientId: string) {
  const user = await requireRole("ADMIN")

  const patient = await prisma.patient.findUnique({ where: { id: patientId } })
  if (!patient) throw new Error("Patient not found")

  await prisma.patient.delete({ where: { id: patientId } })

  await logAudit({
    action: "PATIENT_DELETED",
    entityType: "Patient",
    entityId: patientId,
    metadata: { uhid: patient.uhid, name: `${patient.firstName} ${patient.lastName || ""}`.trim() },
    userId: user.id,
    userName: user.name,
    userRole: user.role,
  })

  revalidatePath("/patients")
}

export async function updatePatientStatus(patientId: string, status: "ACTIVE" | "INACTIVE") {
  await requireRole("ADMIN", "DOCTOR")
  await prisma.patient.update({ where: { id: patientId }, data: { status } })
  revalidatePath(`/patients/${patientId}`)
  revalidatePath("/patients")
}

export async function getPatients(params: {
  query?: string
  status?: string
  tagId?: string
  page?: number
  pageSize?: number
}) {
  const { query, status, tagId, page = 1, pageSize = 20 } = params

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (tagId) where.tags = { some: { tagId } }
  if (query) {
    where.OR = [
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { uhid: { contains: query, mode: "insensitive" } },
      { phone: { contains: query } },
      { email: { contains: query, mode: "insensitive" } },
    ]
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where }),
  ])

  return { patients, total, page, pageSize }
}

export async function getPatientById(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      tags: { include: { tag: true } },
      familyMembers: { orderBy: { createdAt: "desc" } },
      insurances: { orderBy: { createdAt: "desc" } },
      emergencyContacts: { orderBy: { createdAt: "desc" } },
      medicalAlerts: { orderBy: { createdAt: "desc" } },
      allergies: { orderBy: { notedOn: "desc" } },
      chronicDiseases: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      communicationPreference: true,
      registeredBy: true,
    },
  })
  if (!patient) return null
  return {
    ...patient,
    insurances: patient.insurances.map((i) => serializeDecimal(i, ["coverageAmount"])),
    registeredBy: patient.registeredBy ? serializeDecimal(patient.registeredBy, ["consultationFee"]) : null,
  }
}

export async function getPatientInsurances(patientId: string) {
  const insurances = await prisma.insurance.findMany({ where: { patientId }, orderBy: { isPrimary: "desc" } })
  return insurances.map((i) => serializeDecimal(i, ["coverageAmount"]))
}

export async function listAllTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } })
}

export async function createTag(name: string, color: string) {
  const tag = await prisma.tag.create({ data: { name, color } })
  revalidatePath("/patients")
  return tag
}

export async function togglePatientTag(patientId: string, tagId: string) {
  const existing = await prisma.patientTag.findUnique({
    where: { patientId_tagId: { patientId, tagId } },
  })
  if (existing) {
    await prisma.patientTag.delete({ where: { patientId_tagId: { patientId, tagId } } })
  } else {
    await prisma.patientTag.create({ data: { patientId, tagId } })
  }
  revalidatePath(`/patients/${patientId}`)
}

// ── Family members ─────────────────────────────────────────────────────

export async function addFamilyMember(patientId: string, input: FamilyMemberInput) {
  const data = familyMemberSchema.parse(input)
  await prisma.familyMember.create({ data: { ...data, patientId } })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteFamilyMember(patientId: string, id: string) {
  await prisma.familyMember.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Insurance ───────────────────────────────────────────────────────────

export async function addInsurance(patientId: string, input: InsuranceInput) {
  const data = insuranceSchema.parse(input)
  await prisma.insurance.create({ data: { ...data, patientId } })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteInsurance(patientId: string, id: string) {
  await prisma.insurance.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Emergency contacts ──────────────────────────────────────────────────

export async function addEmergencyContact(patientId: string, input: EmergencyContactInput) {
  const data = emergencyContactSchema.parse(input)
  await prisma.emergencyContact.create({ data: { ...data, patientId } })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteEmergencyContact(patientId: string, id: string) {
  await prisma.emergencyContact.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Medical alerts ──────────────────────────────────────────────────────

export async function addMedicalAlert(patientId: string, input: MedicalAlertInput) {
  const data = medicalAlertSchema.parse(input)
  await prisma.medicalAlert.create({ data: { ...data, patientId } })
  revalidatePath(`/patients/${patientId}`)
}

export async function toggleMedicalAlert(patientId: string, id: string, active: boolean) {
  await prisma.medicalAlert.update({ where: { id }, data: { active } })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteMedicalAlert(patientId: string, id: string) {
  await prisma.medicalAlert.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Allergies ───────────────────────────────────────────────────────────

export async function addAllergy(patientId: string, input: AllergyInput) {
  const data = allergySchema.parse(input)
  await prisma.allergy.create({ data: { ...data, patientId } })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteAllergy(patientId: string, id: string) {
  await prisma.allergy.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Chronic diseases ────────────────────────────────────────────────────

export async function addChronicDisease(patientId: string, input: ChronicDiseaseInput) {
  const data = chronicDiseaseSchema.parse(input)
  await prisma.chronicDisease.create({ data: { ...data, patientId } })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteChronicDisease(patientId: string, id: string) {
  await prisma.chronicDisease.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Documents ───────────────────────────────────────────────────────────

export async function addDocument(patientId: string, input: DocumentInput) {
  const data = documentSchema.parse(input)
  const user = await getCurrentUser()
  await prisma.document.create({
    data: { ...data, patientId, uploadedById: user.id },
  })
  revalidatePath(`/patients/${patientId}`)
}

export async function deleteDocument(patientId: string, id: string) {
  await prisma.document.delete({ where: { id } })
  revalidatePath(`/patients/${patientId}`)
}

// ── Communication preferences ──────────────────────────────────────────

export async function upsertCommunicationPreference(patientId: string, input: CommunicationPreferenceInput) {
  const data = communicationPreferenceSchema.parse(input)
  await prisma.communicationPreference.upsert({
    where: { patientId },
    create: { ...data, patientId },
    update: data,
  })
  revalidatePath(`/patients/${patientId}`)
}

export async function getPatientPrescriptions(patientId: string) {
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId },
    include: {
      doctor: true,
      items: true,
      encounter: {
        include: { doctor: true, diagnoses: true },
      },
    },
    orderBy: { issuedAt: "desc" },
  })
  return prescriptions.map((p) => ({
    ...p,
    doctor: serializeDecimal(p.doctor, ["consultationFee"]),
  }))
}

