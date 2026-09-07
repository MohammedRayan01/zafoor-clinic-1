import { z } from "zod"

export const genderEnum = z.enum(["MALE", "FEMALE", "OTHER"])
export const bloodGroupEnum = z.enum([
  "A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN",
])
export const careCategoryEnum = z.enum(["SKIN_HAIR_LASER", "DIABETOLOGY", "GENERAL_MEDICINE"])
export const patientCoreSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  careCategory: careCategoryEnum,
  lastName: z.string().trim().optional(),
  dob: z.string().optional(),
  gender: genderEnum.optional(),
  bloodGroup: bloodGroupEnum.optional(),
  occupation: z.string().trim().optional(),
  heightCm: z.number().positive().max(300).optional(),
  weightKg: z.number().positive().max(500).optional(),
  medicalHistoryNotes: z.string().trim().optional(),
  allergyNotes: z.string().trim().optional(),
  phone: z.string().trim().min(7, "Enter a valid phone number"),
  alternatePhone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
})
export type PatientCoreInput = z.infer<typeof patientCoreSchema>

export const familyMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  relation: z.string().trim().min(1, "Relation is required"),
  phone: z.string().trim().optional(),
  dob: z.coerce.date().optional().nullable(),
  isEmergencyContact: z.boolean().optional(),
})
export type FamilyMemberInput = z.infer<typeof familyMemberSchema>

export const insuranceSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  policyNumber: z.string().trim().min(1, "Policy number is required"),
  planName: z.string().trim().optional(),
  tpaName: z.string().trim().optional(),
  coverageAmount: z.coerce.number().optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
  isPrimary: z.boolean().optional(),
})
export type InsuranceInput = z.infer<typeof insuranceSchema>

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  relation: z.string().trim().min(1, "Relation is required"),
  phone: z.string().trim().min(7, "Enter a valid phone number"),
  altPhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
})
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>

export const medicalAlertSchema = z.object({
  type: z.enum(["ALLERGY", "CONDITION", "DEVICE", "BEHAVIORAL", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().trim().min(1, "Description is required"),
})
export type MedicalAlertInput = z.infer<typeof medicalAlertSchema>

export const allergySchema = z.object({
  allergen: z.string().trim().min(1, "Allergen is required"),
  reaction: z.string().trim().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
})
export type AllergyInput = z.infer<typeof allergySchema>

export const chronicDiseaseSchema = z.object({
  name: z.string().trim().min(1, "Condition name is required"),
  diagnosedOn: z.coerce.date().optional().nullable(),
  status: z.enum(["ACTIVE", "MANAGED", "RESOLVED"]),
  notes: z.string().trim().optional(),
})
export type ChronicDiseaseInput = z.infer<typeof chronicDiseaseSchema>

export const communicationPreferenceSchema = z.object({
  preferredChannel: z.enum(["SMS", "EMAIL", "WHATSAPP", "CALL", "SYSTEM"]),
  allowSms: z.boolean(),
  allowEmail: z.boolean(),
  allowWhatsapp: z.boolean(),
  allowCall: z.boolean(),
  allowMarketing: z.boolean(),
  preferredLanguage: z.string().trim().min(1),
})
export type CommunicationPreferenceInput = z.infer<typeof communicationPreferenceSchema>

export const documentSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  category: z.enum(["ID_PROOF", "INSURANCE", "LAB_REPORT", "PRESCRIPTION", "CONSENT_FORM", "OTHER"]),
  fileUrl: z.string().trim().min(1, "File is required"),
  fileType: z.string().trim().optional(),
})
export type DocumentInput = z.infer<typeof documentSchema>
