"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { serializeDecimal } from "@/lib/serialize"
import {
  vitalsSchema,
  diagnosisSchema,
  clinicalNoteSchema,
  prescriptionSchema,
  type VitalsInput,
  type DiagnosisInput,
  type ClinicalNoteInput,
  type PrescriptionInput,
} from "@/lib/validations/emr"

async function assertDraft(encounterId: string) {
  const encounter = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } })
  if (encounter.status === "FINALIZED") {
    throw new Error("This consultation has been signed and finalized. It can no longer be edited.")
  }
  return encounter
}

function computeBmi(heightCm?: number | null, weightKg?: number | null) {
  if (!heightCm || !weightKg) return null
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

// ── Encounter lifecycle ────────────────────────────────────────────────

export async function createEncounter(params: { patientId: string; doctorId: string; appointmentId?: string }) {
  const encounter = await prisma.encounter.create({
    data: {
      patientId: params.patientId,
      doctorId: params.doctorId,
      appointmentId: params.appointmentId,
      clinicalNote: {
        create: {
          patientId: params.patientId,
          doctorId: params.doctorId,
        },
      },
    },
  })
  revalidatePath(`/patients/${params.patientId}`)
  return encounter
}

export async function getEncounter(encounterId: string) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      patient: { include: { medicalAlerts: true, allergies: true } },
      doctor: true,
      vitals: { orderBy: { recordedAt: "desc" } },
      diagnoses: { orderBy: { createdAt: "desc" } },
      clinicalNote: { include: { versions: { orderBy: { versionNumber: "desc" } } } },
      prescriptions: { include: { items: true } },
      reports: { include: { labResults: true } },
    },
  })
  if (!encounter) return null
  return {
    ...encounter,
    doctor: serializeDecimal(encounter.doctor, ["consultationFee"]),
    vitals: encounter.vitals.map((v) => serializeDecimal(v, ["heightCm", "weightKg", "bmi", "temperatureC"])),
  }
}

export async function getEncountersForPatient(patientId: string) {
  const encounters = await prisma.encounter.findMany({
    where: { patientId },
    include: {
      doctor: true,
      diagnoses: { orderBy: { createdAt: "desc" } },
      vitals: { orderBy: { recordedAt: "desc" } },
      clinicalNote: true,
      prescriptions: { include: { items: true, doctor: true } },
      reports: { include: { labResults: true } },
    },
    orderBy: { encounterDate: "desc" },
  })
  return encounters.map((e) => ({
    ...e,
    doctor: serializeDecimal(e.doctor, ["consultationFee"]),
    vitals: e.vitals.map((v) => serializeDecimal(v, ["heightCm", "weightKg", "bmi", "temperatureC"])),
    prescriptions: e.prescriptions.map((p) => ({
      ...p,
      doctor: serializeDecimal(p.doctor, ["consultationFee"]),
    })),
  }))
}

export async function getActiveEncounterForAppointment(appointmentId: string) {
  return prisma.encounter.findFirst({ where: { appointmentId } })
}

export async function updateChiefComplaints(encounterId: string, chiefComplaints: string[]) {
  await assertDraft(encounterId)
  const encounter = await prisma.encounter.update({
    where: { id: encounterId },
    data: { chiefComplaints: chiefComplaints.filter((c) => c.trim().length > 0) },
  })
  revalidatePath(`/patients/${encounter.patientId}/encounters/${encounterId}`)
  return encounter
}

export async function signEncounter(encounterId: string) {
  const encounter = await assertDraft(encounterId)
  const user = await getCurrentUser()
  const now = new Date()

  await prisma.$transaction([
    prisma.encounter.update({
      where: { id: encounterId },
      data: { status: "FINALIZED", signedAt: now },
    }),
    prisma.clinicalNote.updateMany({
      where: { encounterId },
      data: { status: "SIGNED", signedAt: now },
    }),
  ])

  revalidatePath(`/patients/${encounter.patientId}/encounters/${encounterId}`)
  revalidatePath(`/patients/${encounter.patientId}`)
  return { doctorId: user.id }
}

// ── Vitals ──────────────────────────────────────────────────────────────

export async function saveVitals(encounterId: string, patientId: string, input: VitalsInput) {
  await assertDraft(encounterId)
  const data = vitalsSchema.parse(input)
  const bmi = computeBmi(data.heightCm, data.weightKg)

  const existing = await prisma.vitals.findFirst({ where: { encounterId }, orderBy: { recordedAt: "desc" } })
  const vitals = existing
    ? await prisma.vitals.update({ where: { id: existing.id }, data: { ...data, bmi } })
    : await prisma.vitals.create({ data: { ...data, bmi, encounterId, patientId } })

  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`)
  return serializeDecimal(vitals, ["heightCm", "weightKg", "bmi", "temperatureC"])
}

// ── Diagnoses ───────────────────────────────────────────────────────────

export async function addDiagnosis(encounterId: string, patientId: string, input: DiagnosisInput) {
  await assertDraft(encounterId)
  const data = diagnosisSchema.parse(input)
  const diagnosis = await prisma.diagnosis.create({ data: { ...data, encounterId, patientId } })
  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`)
  return diagnosis
}

export async function updateDiagnosisStatus(encounterId: string, id: string, status: "ACTIVE" | "RESOLVED") {
  const diagnosis = await prisma.diagnosis.update({ where: { id }, data: { status } })
  revalidatePath(`/patients/${diagnosis.patientId}/encounters/${encounterId}`)
  return diagnosis
}

export async function deleteDiagnosis(encounterId: string, id: string) {
  await assertDraft(encounterId)
  const diagnosis = await prisma.diagnosis.delete({ where: { id } })
  revalidatePath(`/patients/${diagnosis.patientId}/encounters/${encounterId}`)
}

// ── Clinical note (SOAP) — autosave with version history ───────────────

export async function autosaveClinicalNote(encounterId: string, input: ClinicalNoteInput) {
  await assertDraft(encounterId)
  const data = clinicalNoteSchema.parse(input)

  const note = await prisma.clinicalNote.findUniqueOrThrow({ where: { encounterId } })
  const nextVersion = note.version + 1

  const [updated] = await prisma.$transaction([
    prisma.clinicalNote.update({
      where: { encounterId },
      data: { ...data, version: nextVersion },
    }),
    prisma.clinicalNoteVersion.create({
      data: { clinicalNoteId: note.id, versionNumber: nextVersion, ...data },
    }),
  ])

  return { savedAt: updated.updatedAt, version: updated.version }
}

// ── Prescriptions issued during this encounter ─────────────────────────

export async function createEncounterPrescription(
  encounterId: string,
  patientId: string,
  doctorId: string,
  input: PrescriptionInput
) {
  await assertDraft(encounterId)
  const data = prescriptionSchema.parse(input)
  const prescription = await prisma.prescription.create({
    data: {
      patientId,
      doctorId,
      encounterId,
      diagnosis: data.diagnosis || null,
      notes: data.notes || null,
      items: { create: data.items },
    },
    include: { items: true },
  })
  revalidatePath(`/patients/${patientId}/encounters/${encounterId}`)
  return prescription
}

export async function getClinicalNoteVersions(clinicalNoteId: string) {
  return prisma.clinicalNoteVersion.findMany({
    where: { clinicalNoteId },
    orderBy: { versionNumber: "desc" },
  })
}
