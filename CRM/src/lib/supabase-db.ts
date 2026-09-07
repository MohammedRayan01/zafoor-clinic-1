import { getSupabase } from "./supabase"
import { nanoid } from "nanoid"

/**
 * Prisma-style nested writes (`items: { create: [...] }`) used throughout
 * src/actions/*.ts assume a real Prisma client, which understands the schema
 * and performs the child inserts itself. This wrapper talks to PostgREST
 * directly and has no such awareness — without this map, `create()` used to
 * spread the nested `{ create: ... }` object straight into the parent row's
 * insert payload, which PostgREST rejects ("Could not find the 'x' column").
 * Maps "ParentTable.relationField" -> the child table and the FK column on
 * it that must be set to the parent's id.
 */
/**
 * Models with an `@updatedAt` field in schema.prisma. A real Prisma client
 * stamps this itself on every write; this wrapper talks to PostgREST
 * directly and never did, which is silently wrong on update() (the column
 * goes stale forever) and outright fails create() wherever the column has
 * no DB-level default (NOT NULL violation). Auto-stamped below instead.
 */
const TABLES_WITH_UPDATED_AT = new Set([
  "Patient",
  "CommunicationPreference",
  "Service",
  "Encounter",
  "ClinicalNote",
  "DigitalSignature",
  "ClinicSettings",
  "InventoryItem",
  "InventoryAlert",
  "WhatsAppTemplate",
])

const NESTED_CREATE_MAP: Record<string, { table: string; fk: string }> = {
  "Bill.items": { table: "BillItem", fk: "billId" },
  "Prescription.items": { table: "PrescriptionItem", fk: "prescriptionId" },
  "Patient.communicationPreference": { table: "CommunicationPreference", fk: "patientId" },
  "Patient.medicalHistory": { table: "MedicalHistory", fk: "patientId" },
  "Patient.allergies": { table: "Allergy", fk: "patientId" },
  "Encounter.clinicalNote": { table: "ClinicalNote", fk: "encounterId" },
  "ClinicalReport.labResults": { table: "LabResultItem", fk: "reportId" },
}

// Comprehensive Map of relational foreign keys for PostgREST joins
const RELATION_MAP: Record<string, Record<string, string>> = {
  User: {
    doctorAvailabilities: "doctorAvailabilities:DoctorAvailability!DoctorAvailability_doctorId_fkey(*)",
    doctorLeaves: "doctorLeaves:DoctorLeave!DoctorLeave_doctorId_fkey(*)",
  },
  Appointment: {
    doctor: "doctor:User!Appointment_doctorId_fkey(*)",
    createdBy: "createdBy:User!Appointment_createdById_fkey(*)",
    patient: "patient:Patient(*)",
    service: "service:Service(*)",
  },
  Patient: {
    registeredBy: "registeredBy:User!Patient_registeredById_fkey(*)",
    appointments: "appointments:Appointment(*)",
    bills: "bills:Bill(*)",
    tags: "tags:PatientTag(*, tag:Tag(*))",
    medicalAlerts: "medicalAlerts:MedicalAlert(*)",
    allergies: "allergies:Allergy(*)",
    chronicDiseases: "chronicDiseases:ChronicDisease(*)",
    medicalHistory: "medicalHistory:MedicalHistory(*)",
    familyHistory: "familyHistory:FamilyHistoryEntry(*)",
    surgicalHistory: "surgicalHistory:SurgicalHistory(*)",
    currentMedications: "currentMedications:CurrentMedication(*)",
    clinicalReports: "clinicalReports:ClinicalReport(*)",
    referralNotes: "referralNotes:ReferralNote(*)",
    certificates: "certificates:Certificate(*)",
    feedback: "feedback:Feedback(*)",
    messages: "messages:Message(*)",
    refunds: "refunds:Refund(*)",
    advances: "advances:PatientAdvance(*)",
    waitingListEntries: "waitingListEntries:WaitingListEntry(*)",
    prescriptions: "prescriptions:Prescription(*, items:PrescriptionItem(*))",
    encounters: "encounters:Encounter(*)",
    documents: "documents:Document(*)",
    notes: "notes:PatientNote(*)",
    followUps: "followUps:FollowUp(*)",
    emergencyContacts: "emergencyContacts:EmergencyContact(*)",
    familyMembers: "familyMembers:FamilyMember!FamilyMember_patientId_fkey(*)",
    relatedToFamilyOf: "relatedToFamilyOf:FamilyMember!FamilyMember_relatedPatientId_fkey(*)",
    insurances: "insurances:Insurance(*)",
    communicationPreference: "communicationPreference:CommunicationPreference(*)",
  },
  FollowUp: {
    patient: "patient:Patient(*)",
    assignedTo: "assignedTo:User!FollowUp_assignedToId_fkey(*)",
  },
  PatientTag: {
    tag: "tag:Tag(*)",
    patient: "patient:Patient(*)",
  },
  Bill: {
    patient: "patient:Patient(*)",
    appointment: "appointment:Appointment(*)",
    insurance: "insurance:Insurance(*)",
    service: "service:Service(*)",
    items: "items:BillItem(*)",
    payments: "payments:Payment(*)",
    refunds: "refunds:Refund(*)",
    advanceAdjustments: "advanceAdjustments:AdvanceAdjustment(*)",
  },
  BillItem: {
    bill: "bill:Bill(*)",
    service: "service:Service(*)",
  },
  Payment: {
    bill: "bill:Bill(*, items:BillItem(*))",
    patient: "patient:Patient(*)",
    receivedBy: "receivedBy:User!Payment_receivedById_fkey(*)",
    cashSession: "cashSession:CashSession(*)",
  },
  Session: {
    user: "user:User(*)",
  },
  DoctorAvailability: {
    doctor: "doctor:User!DoctorAvailability_doctorId_fkey(*)",
  },
  Prescription: {
    patient: "patient:Patient(*)",
    doctor: "doctor:User!Prescription_doctorId_fkey(*)",
    items: "items:PrescriptionItem(*)",
  },
  PrescriptionItem: {
    prescription: "prescription:Prescription(*)",
  },
  Encounter: {
    patient: "patient:Patient(*, allergies:Allergy(*), medicalAlerts:MedicalAlert(*))",
    doctor: "doctor:User!Encounter_doctorId_fkey(*)",
    clinicalNote: "clinicalNote:ClinicalNote(*, versions:ClinicalNoteVersion(*))",
    prescriptions: "prescriptions:Prescription(*, items:PrescriptionItem(*), doctor:User!Prescription_doctorId_fkey(*))",
    reports: "reports:ClinicalReport(*, labResults:LabResultItem(*))",
    diagnoses: "diagnoses:Diagnosis(*)",
  },
  ClinicalNote: {
    versions: "versions:ClinicalNoteVersion(*)",
    doctor: "doctor:User!ClinicalNote_doctorId_fkey(*)",
  },
  ClinicalReport: {
    labResults: "labResults:LabResultItem(*)",
    doctor: "doctor:User!ClinicalReport_doctorId_fkey(*)",
    patient: "patient:Patient(*)",
  },
  ReferralNote: {
    fromDoctor: "fromDoctor:User!ReferralNote_fromDoctorId_fkey(*)",
    patient: "patient:Patient(*)",
  },
  Certificate: {
    doctor: "doctor:User!Certificate_doctorId_fkey(*)",
    patient: "patient:Patient(*)",
  },
  PatientNote: {
    author: "author:User!PatientNote_authorId_fkey(*)",
    patient: "patient:Patient(*)",
  },
  Message: {
    sentBy: "sentBy:User!Message_sentById_fkey(*)",
    patient: "patient:Patient(*)",
  },
  Expense: {
    recordedBy: "recordedBy:User!Expense_recordedById_fkey(*)",
  },
  CashSession: {
    openedBy: "openedBy:User!CashSession_openedById_fkey(*)",
    closedBy: "closedBy:User!CashSession_closedById_fkey(*)",
    payments: "payments:Payment(*)",
  },
  InventoryItem: {
    transactions: "transactions:InventoryTransaction(*)",
    alerts: "alerts:InventoryAlert(*)",
  },
  InventoryTransaction: {
    performedBy: "performedBy:User!InventoryTransaction_performedById_fkey(*)",
    patient: "patient:Patient(*)",
    item: "item:InventoryItem(*)",
  },
  InventoryAlert: {
    item: "item:InventoryItem(*)",
  },
  DoctorLeave: {
    doctor: "doctor:User!DoctorLeave_doctorId_fkey(*)",
  },
  WaitingListEntry: {
    doctor: "doctor:User!WaitingListEntry_doctorId_fkey(*)",
    patient: "patient:Patient(*)",
  },
  Refund: {
    processedBy: "processedBy:User!Refund_processedById_fkey(*)",
    bill: "bill:Bill(*)",
    patient: "patient:Patient(*)",
  },
  PatientAdvance: {
    receivedBy: "receivedBy:User!PatientAdvance_receivedById_fkey(*)",
    patient: "patient:Patient(*)",
  },
  AdvanceAdjustment: {
    bill: "bill:Bill(*)",
    advance: "advance:PatientAdvance(*)",
  },
  Review: {
    service: "service:Service(*)",
  },
  DoctorTemplate: {
    owner: "owner:User!DoctorTemplate_ownerId_fkey(*)",
  },
  DigitalSignature: {
    user: "user:User!DigitalSignature_userId_fkey(*)",
  },
  Feedback: {
    patient: "patient:Patient(*)",
  },
  WebsiteService: {
    service: "service:Service(*)",
  },
}

function buildSelect(tableName: string, include?: Record<string, any>, select?: Record<string, any>): string {
  if (!include && !select) return "*"

  const parts: string[] = []
  if (select) {
    for (const [key, val] of Object.entries(select)) {
      if (key === "_count") continue
      if (val === true) {
        parts.push(key)
      } else if (typeof val === "object") {
        const rel = RELATION_MAP[tableName]?.[key] || `${key}:${key.charAt(0).toUpperCase() + key.slice(1)}(*)`
        parts.push(rel)
      }
    }
    return parts.length > 0 ? parts.join(",") : "*"
  }

  parts.push("*")
  if (include) {
    for (const [key, val] of Object.entries(include)) {
      if (key === "_count") continue
      if (val) {
        const rel = RELATION_MAP[tableName]?.[key] || `${key}:${key.charAt(0).toUpperCase() + key.slice(1)}(*)`
        parts.push(rel)
      }
    }
  }
  return parts.join(",")
}

function applyWhere(query: any, where?: Record<string, any>) {
  if (!where) return query

  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue

    if (key === "OR" && Array.isArray(val)) {
      const orClauses: string[] = []
      for (const item of val) {
        for (const [subKey, subVal] of Object.entries(item)) {
          if (typeof subVal === "string") {
            orClauses.push(`${subKey}.eq.${subVal}`)
          } else if (subVal && typeof subVal === "object" && "contains" in subVal) {
            orClauses.push(`${subKey}.ilike.%${(subVal as any).contains}%`)
          } else if (typeof subVal === "number" || typeof subVal === "boolean") {
            orClauses.push(`${subKey}.eq.${subVal}`)
          }
        }
      }
      if (orClauses.length > 0) {
        query = query.or(orClauses.join(","))
      }
      continue
    }

    if (val === null) {
      query = query.is(key, null)
    } else if (typeof val === "object") {
      if ("equals" in val) {
        query = val.equals === null ? query.is(key, null) : query.eq(key, val.equals)
      }
      if ("in" in val && Array.isArray(val.in)) {
        query = query.in(key, val.in)
      }
      if ("notIn" in val && Array.isArray(val.notIn)) {
        query = query.not(key, "in", `(${val.notIn.join(",")})`)
      }
      if ("not" in val) {
        query = val.not === null ? query.not(key, "is", null) : query.neq(key, val.not)
      }
      if ("contains" in val) {
        const pattern = `%${val.contains}%`
        query = val.mode === "insensitive" ? query.ilike(key, pattern) : query.like(key, pattern)
      }
      if ("startsWith" in val) {
        query = query.like(key, `${val.startsWith}%`)
      }
      if ("gte" in val) {
        query = query.gte(key, val.gte instanceof Date ? val.gte.toISOString() : val.gte)
      }
      if ("lte" in val) {
        query = query.lte(key, val.lte instanceof Date ? val.lte.toISOString() : val.lte)
      }
      if ("gt" in val) {
        query = query.gt(key, val.gt instanceof Date ? val.gt.toISOString() : val.gt)
      }
      if ("lt" in val) {
        query = query.lt(key, val.lt instanceof Date ? val.lt.toISOString() : val.lt)
      }
    } else if (val instanceof Date) {
      query = query.eq(key, val.toISOString())
    } else {
      query = query.eq(key, val)
    }
  }

  return query
}

function applyOrder(query: any, orderBy?: any) {
  if (!orderBy) return query
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
  for (const ord of orders) {
    for (const [col, dir] of Object.entries(ord)) {
      query = query.order(col, { ascending: dir === "asc" })
    }
  }
  return query
}

// PostgREST returns timestamp columns as ISO strings, but the rest of the
// codebase was written against Prisma's Date objects (e.g. `.getTime()`,
// `date-fns` calls). Deep-walk every row and turn ISO-date-looking strings
// back into real Date instances so callers don't have to know the difference.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/

function hydrateDates<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(hydrateDates) as any
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value)
    return (isNaN(d.getTime()) ? value : d) as any
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, any> = {}
    for (const key of Object.keys(value as Record<string, any>)) {
      out[key] = hydrateDates((value as Record<string, any>)[key])
    }
    return out as any
  }
  return value
}

function createModelDelegate(tableName: string) {
  return {
    async findUnique(args: { where: Record<string, any>; include?: any; select?: any }) {
      const supabase = getSupabase()
      const sel = buildSelect(tableName, args.include, args.select)
      let q = supabase.from(tableName).select(sel)
      q = applyWhere(q, args.where)
      const { data, error } = await q.maybeSingle()
      if (error && error.code !== "PGRST116") {
        console.error(`[SupabaseDB ${tableName}.findUnique] error:`, JSON.stringify(error))
      }
      return hydrateDates(data)
    },

    async findFirst(args?: { where?: Record<string, any>; include?: any; select?: any; orderBy?: any }) {
      const supabase = getSupabase()
      const sel = buildSelect(tableName, args?.include, args?.select)
      let q = supabase.from(tableName).select(sel)
      q = applyWhere(q, args?.where)
      q = applyOrder(q, args?.orderBy)
      const { data, error } = await q.limit(1).maybeSingle()
      if (error && error.code !== "PGRST116") {
        console.error(`[SupabaseDB ${tableName}.findFirst] error:`, JSON.stringify(error))
      }
      return hydrateDates(data)
    },

    async findMany(args?: {
      where?: Record<string, any>
      include?: any
      select?: any
      orderBy?: any
      skip?: number
      take?: number
      distinct?: any
    }) {
      const supabase = getSupabase()
      const sel = buildSelect(tableName, args?.include, args?.select)
      let q = supabase.from(tableName).select(sel)
      q = applyWhere(q, args?.where)
      q = applyOrder(q, args?.orderBy)
      if (args?.skip !== undefined && args?.take !== undefined) {
        q = q.range(args.skip, args.skip + args.take - 1)
      } else if (args?.take !== undefined) {
        q = q.limit(args.take)
      }
      const { data, error } = await q
      if (error) {
        console.error(`[SupabaseDB ${tableName}.findMany] error:`, JSON.stringify(error))
        // Non-blocking fallback for missing relations
        return []
      }
      return hydrateDates(data || [])
    },

    async create(args: { data: Record<string, any>; include?: any; select?: any }) {
      const supabase = getSupabase()
      const payload = { ...args.data }
      if (!payload.id) {
        payload.id = tableName.toLowerCase().slice(0, 4) + "_" + nanoid(20)
      }
      if (TABLES_WITH_UPDATED_AT.has(tableName) && payload.updatedAt === undefined) {
        payload.updatedAt = new Date().toISOString()
      }

      // Pull out any Prisma-style nested writes before the flat insert —
      // see NESTED_CREATE_MAP above for why this is necessary.
      const nestedWrites: { key: string; table: string; fk: string; rows: Record<string, any>[]; many: boolean }[] = []
      for (const key of Object.keys(payload)) {
        const val = payload[key]
        if (val && typeof val === "object" && !Array.isArray(val) && "create" in val) {
          const mapping = NESTED_CREATE_MAP[`${tableName}.${key}`]
          if (mapping) {
            const many = Array.isArray(val.create)
            const rows = many ? val.create : [val.create]
            nestedWrites.push({ key, table: mapping.table, fk: mapping.fk, rows, many })
          }
          delete payload[key]
        }
      }

      const sel = buildSelect(tableName, args.include, args.select)
      const result = await supabase.from(tableName).insert(payload).select(sel).single()
      const error = result.error
      const data = result.data as any
      if (error) {
        console.error(`[SupabaseDB ${tableName}.create] error:`, JSON.stringify(error))
        throw new Error(error.message)
      }

      for (const nw of nestedWrites) {
        const childPayload = nw.rows.map((row) => ({
          id: row.id || nw.table.toLowerCase().slice(0, 4) + "_" + nanoid(20),
          [nw.fk]: data.id,
          ...(TABLES_WITH_UPDATED_AT.has(nw.table) && row.updatedAt === undefined
            ? { updatedAt: new Date().toISOString() }
            : {}),
          ...row,
        }))
        const { data: childData, error: childError } = await supabase.from(nw.table).insert(childPayload).select()
        if (childError) {
          console.error(`[SupabaseDB ${tableName}.create] nested ${nw.table} insert error:`, JSON.stringify(childError))
          throw new Error(childError.message)
        }
        data[nw.key] = nw.many ? childData : (childData?.[0] ?? null)
      }

      return hydrateDates(data)
    },

    async createMany(args: { data: Record<string, any>[] }) {
      const supabase = getSupabase()
      const payloads = args.data.map((d) => ({
        id: d.id || tableName.toLowerCase().slice(0, 4) + "_" + nanoid(20),
        ...d,
      }))
      const { data, error } = await supabase.from(tableName).insert(payloads).select()
      if (error) {
        console.error(`[SupabaseDB ${tableName}.createMany] error:`, JSON.stringify(error))
        throw new Error(error.message)
      }
      return { count: data?.length || 0 }
    },

    async update(args: { where: Record<string, any>; data: Record<string, any>; include?: any; select?: any }) {
      const supabase = getSupabase()
      const updateData = { ...args.data }
      if (TABLES_WITH_UPDATED_AT.has(tableName) && updateData.updatedAt === undefined) {
        updateData.updatedAt = new Date().toISOString()
      }
      const sel = buildSelect(tableName, args.include, args.select)
      let q = supabase.from(tableName).update(updateData)
      q = applyWhere(q, args.where)
      const { data, error } = await q.select(sel).single()
      if (error) {
        console.error(`[SupabaseDB ${tableName}.update] error:`, JSON.stringify(error))
        throw new Error(error.message)
      }
      return hydrateDates(data)
    },

    async updateMany(args: { where?: Record<string, any>; data: Record<string, any> }) {
      const supabase = getSupabase()
      let q = supabase.from(tableName).update(args.data)
      q = applyWhere(q, args.where)
      const { data, error } = await q.select()
      if (error) {
        console.error(`[SupabaseDB ${tableName}.updateMany] error:`, JSON.stringify(error))
        throw new Error(error.message)
      }
      return { count: data?.length || 0 }
    },

    async delete(args: { where: Record<string, any>; include?: any; select?: any }) {
      const supabase = getSupabase()
      const sel = buildSelect(tableName, args.include, args.select)
      let q = supabase.from(tableName).delete()
      q = applyWhere(q, args.where)
      const { data, error } = await q.select(sel).maybeSingle()
      if (error) {
        console.error(`[SupabaseDB ${tableName}.delete] error:`, JSON.stringify(error))
        throw new Error(error.message)
      }
      return hydrateDates(data)
    },

    async deleteMany(args?: { where?: Record<string, any> }) {
      const supabase = getSupabase()
      let q = supabase.from(tableName).delete()
      q = applyWhere(q, args?.where)
      const { data, error } = await q.select()
      if (error) {
        console.error(`[SupabaseDB ${tableName}.deleteMany] error:`, JSON.stringify(error))
        throw new Error(error.message)
      }
      return { count: data?.length || 0 }
    },

    async upsert(args: {
      where: Record<string, any>
      create: Record<string, any>
      update: Record<string, any>
      include?: any
      select?: any
    }) {
      const existing = await this.findFirst({ where: args.where })
      if (existing) {
        return await this.update({ where: args.where, data: args.update, include: args.include, select: args.select })
      } else {
        return await this.create({ data: { ...args.create, ...args.where }, include: args.include, select: args.select })
      }
    },

    async count(args?: { where?: Record<string, any> }) {
      const supabase = getSupabase()
      let q = supabase.from(tableName).select("*", { count: "exact", head: true })
      q = applyWhere(q, args?.where)
      const { count, error } = await q
      if (error) {
        console.error(`[SupabaseDB ${tableName}.count] error:`, JSON.stringify(error))
        return 0
      }
      return count || 0
    },

    async aggregate(args?: {
      where?: Record<string, any>
      _sum?: Record<string, boolean>
      _avg?: Record<string, boolean>
      _min?: Record<string, boolean>
      _max?: Record<string, boolean>
      _count?: Record<string, boolean> | boolean
    }) {
      const items = await this.findMany({ where: args?.where })
      const result: Record<string, any> = {}

      if (args?._sum) {
        result._sum = {}
        for (const key of Object.keys(args._sum)) {
          result._sum[key] = items.reduce((sum: number, item: any) => sum + (Number(item[key]) || 0), 0)
        }
      }

      if (args?._avg) {
        result._avg = {}
        for (const key of Object.keys(args._avg)) {
          const total = items.reduce((sum: number, item: any) => sum + (Number(item[key]) || 0), 0)
          result._avg[key] = items.length > 0 ? total / items.length : 0
        }
      }

      if (args?._min) {
        result._min = {}
        for (const key of Object.keys(args._min)) {
          const vals = items.map((i: any) => Number(i[key])).filter((v: number) => !isNaN(v))
          result._min[key] = vals.length > 0 ? Math.min(...vals) : null
        }
      }

      if (args?._max) {
        result._max = {}
        for (const key of Object.keys(args._max)) {
          const vals = items.map((i: any) => Number(i[key])).filter((v: number) => !isNaN(v))
          result._max[key] = vals.length > 0 ? Math.max(...vals) : null
        }
      }

      if (args?._count) {
        if (typeof args._count === "boolean") {
          result._count = items.length
        } else {
          result._count = {}
          for (const key of Object.keys(args._count)) {
            result._count[key] = items.filter((i: any) => i[key] != null).length
          }
        }
      }

      return result
    },

    async groupBy(args: {
      by: string[]
      where?: Record<string, any>
      _sum?: Record<string, boolean>
      _count?: Record<string, boolean> | boolean
    }) {
      const items = await this.findMany({ where: args?.where })
      const groups = new Map<string, any[]>()

      for (const item of items) {
        const groupKey = args.by.map((k) => String(item[k])).join("___")
        if (!groups.has(groupKey)) groups.set(groupKey, [])
        groups.get(groupKey)!.push(item)
      }

      const results: any[] = []
      for (const [, groupItems] of groups.entries()) {
        const row: Record<string, any> = {}
        for (const key of args.by) {
          row[key] = groupItems[0][key]
        }
        if (args._sum) {
          row._sum = {}
          for (const key of Object.keys(args._sum)) {
            row._sum[key] = groupItems.reduce((s, i) => s + (Number(i[key]) || 0), 0)
          }
        }
        if (args._count) {
          row._count = groupItems.length
        }
        results.push(row)
      }
      return results
    },
  }
}

// Table registry
const tables = [
  "User",
  "Session",
  "Counter",
  "Patient",
  "DoctorAvailability",
  "DoctorLeave",
  "Appointment",
  "WaitingListEntry",
  "Prescription",
  "PrescriptionItem",
  "Document",
  "Message",
  "PatientNote",
  "FollowUp",
  "Encounter",
  "ClinicalNote",
  "ClinicalNoteVersion",
  "DoctorTemplate",
  "DigitalSignature",
  "ClinicalReport",
  "ReferralNote",
  "Certificate",
  "Bill",
  "BillItem",
  "Payment",
  "Refund",
  "PatientAdvance",
  "AdvanceAdjustment",
  "CashSession",
  "Expense",
  "InventoryItem",
  "InventoryTransaction",
  "InventoryAlert",
  "ClinicSettings",
  "AuditLog",
  "Service",
  "Review",
  "FAQ",
  "Announcement",
  "MedicalHistory",
  "SurgicalHistory",
  "Allergy",
  "CurrentMedication",
  "ChronicDisease",
  "FamilyHistoryEntry",
  "FamilyMember",
  "EmergencyContact",
  "Insurance",
  "CommunicationPreference",
  "Tag",
  "PatientTag",
  "MedicalAlert",
  "Vitals",
  "Diagnosis",
  "LabResultItem",
  "Feedback",
  "WhatsAppTemplate",
]

export const db: Record<string, any> = {
  async $transaction(fnOrArray: any) {
    if (typeof fnOrArray === "function") {
      return await fnOrArray(db)
    }
    if (Array.isArray(fnOrArray)) {
      return await Promise.all(fnOrArray)
    }
    return fnOrArray
  },
}

for (const name of tables) {
  const camelName = name.charAt(0).toLowerCase() + name.slice(1)
  const delegate = createModelDelegate(name)
  db[camelName] = delegate
  db[name] = delegate
}
