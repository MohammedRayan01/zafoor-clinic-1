import Link from "next/link"
import {
  AlertTriangle,
  HeartPulse,
  ShieldCheck,
  Users,
  Stethoscope,
  Pill,
  FileText,
  Calendar,
  Activity,
  ArrowRight,
  ExternalLink,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  Phone,
  Plus,
  Droplet,
  Ruler,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { getPatientById, getPatientPrescriptions } from "@/actions/patients"
import type { getEncountersForPatient } from "@/actions/encounters"
import type { getClinicalReports } from "@/actions/reports"
import type { getPatientRecords } from "@/actions/records"
import type { getAppointmentsForPatient } from "@/actions/appointments"
import type { getPatientCrmData } from "@/actions/crm"
import {
  alertSeverityColors,
  alertSeverityLabels,
  documentCategoryLabels,
  appointmentStatusColors,
  appointmentStatusLabels,
  appointmentTypeLabels,
  followUpStatusLabels,
  bloodGroupLabels,
} from "@/lib/labels"

function bmiCategory(bmi: number) {
  if (bmi < 18.5) return "Underweight"
  if (bmi < 25) return "Normal"
  if (bmi < 30) return "Overweight"
  return "Obese"
}
import { formatDate, formatDateTime } from "@/lib/format"

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>
type Encounters = Awaited<ReturnType<typeof getEncountersForPatient>>
type Prescriptions = Awaited<ReturnType<typeof getPatientPrescriptions>>
type Reports = Awaited<ReturnType<typeof getClinicalReports>>
type Records = Awaited<ReturnType<typeof getPatientRecords>>
type Appointments = Awaited<ReturnType<typeof getAppointmentsForPatient>>
type FollowUps = Awaited<ReturnType<typeof getPatientCrmData>>["followUps"]

export function OverviewTab({
  patient,
  encounters = [],
  prescriptions = [],
  reports = [],
  records,
  appointments = [],
  followUps = [],
}: {
  patient: Patient
  encounters?: Encounters
  prescriptions?: Prescriptions
  reports?: Reports
  records?: Records
  appointments?: Appointments
  followUps?: FollowUps
}) {
  const activeAlerts = patient.medicalAlerts.filter((a) => a.active)
  const primaryInsurance = patient.insurances.find((i) => i.isPrimary) ?? patient.insurances[0]
  const primaryEmergencyContact = patient.emergencyContacts[0]

  const referralNotesCount = records?.referralNotes?.length || 0
  const certificatesCount = records?.certificates?.length || 0
  const totalDocuments = patient.documents.length + reports.length + referralNotesCount + certificatesCount

  // Most recent visit's recorded vitals, across all encounters (already ordered newest-first).
  const lastVisit = encounters.find((e) => e.vitals && e.vitals.length > 0)
  const lastVitals = lastVisit?.vitals?.[0]
  const currentHeight = patient.heightCm != null ? Number(patient.heightCm) : null
  const currentWeight = patient.weightKg != null ? Number(patient.weightKg) : null
  const currentBmi =
    currentHeight && currentWeight ? currentWeight / ((currentHeight / 100) * (currentHeight / 100)) : null

  return (
    <div className="space-y-6">
      {/* ── 0. Health Summary — blood group, height/weight/BMI/BP now vs last visit, medical history ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Health Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Droplet className="h-3 w-3" /> Blood Group</p>
              <p className="text-lg font-bold mt-0.5">{bloodGroupLabels[patient.bloodGroup ?? "UNKNOWN"] ?? "Unknown"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Ruler className="h-3 w-3" /> Height / Weight</p>
              <p className="text-lg font-bold mt-0.5">
                {currentHeight ?? "—"} cm · {currentWeight ?? "—"} kg
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> BMI (current)</p>
              <p className="text-lg font-bold mt-0.5">
                {currentBmi ? `${currentBmi.toFixed(1)} · ${bmiCategory(currentBmi)}` : "—"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Stethoscope className="h-3 w-3" /> Last Visit BP</p>
              <p className="text-lg font-bold mt-0.5">
                {lastVitals?.bpSystolic && lastVitals?.bpDiastolic
                  ? `${lastVitals.bpSystolic}/${lastVitals.bpDiastolic} mmHg`
                  : "—"}
              </p>
            </div>
          </div>

          {lastVisit && lastVitals && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs">
              <p className="font-semibold text-foreground mb-1">
                Vitals at last visit — {formatDate(lastVisit.encounterDate)}
              </p>
              <div className="flex flex-wrap gap-3 text-muted-foreground">
                {lastVitals.heightCm != null && <span>Height: <strong className="text-foreground">{String(lastVitals.heightCm)} cm</strong></span>}
                {lastVitals.weightKg != null && <span>Weight: <strong className="text-foreground">{String(lastVitals.weightKg)} kg</strong></span>}
                {lastVitals.bmi != null && <span>BMI: <strong className="text-foreground">{String(lastVitals.bmi)}</strong></span>}
                {lastVitals.pulseBpm != null && <span>Pulse: <strong className="text-foreground">{lastVitals.pulseBpm} bpm</strong></span>}
                {lastVitals.temperatureC != null && <span>Temp: <strong className="text-foreground">{String(lastVitals.temperatureC)} °C</strong></span>}
                {lastVitals.spo2 != null && <span>SpO2: <strong className="text-foreground">{lastVitals.spo2}%</strong></span>}
              </div>
            </div>
          )}

          {patient.medicalHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Previous Medical History</p>
              <div className="space-y-1.5">
                {patient.medicalHistory.map((h) => (
                  <div key={h.id} className="text-xs rounded border bg-muted/20 p-2 flex items-start justify-between gap-2">
                    <span>{h.description}</span>
                    <span className="text-muted-foreground shrink-0">
                      {h.occurredOn ? formatDate(h.occurredOn) : formatDate(h.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 1. Medical Critical Alerts ──────────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-base text-red-700 dark:text-red-400">Critical Medical Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-2 text-sm">
                <Badge className={alertSeverityColors[alert.severity]} variant="secondary">
                  {alertSeverityLabels[alert.severity]}
                </Badge>
                <span className="font-medium text-foreground">{alert.description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 2. Quick Clinical & Appointment Metrics Grid ────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{appointments.length}</p>
            <p className="text-xs text-muted-foreground">Appointments</p>
          </div>
        </Card>

        <Card className="p-4 flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{encounters.length}</p>
            <p className="text-xs text-muted-foreground">Consultations</p>
          </div>
        </Card>

        <Card className="p-4 flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{prescriptions.length}</p>
            <p className="text-xs text-muted-foreground">Prescriptions</p>
          </div>
        </Card>

        <Card className="p-4 flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalDocuments}</p>
            <p className="text-xs text-muted-foreground">Docs & Reports</p>
          </div>
        </Card>
      </div>

      {/* ── 3. Appointments & Scheduled Follow-ups ──────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Appointments & Consultations Schedule</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            nativeButton={false}
            render={
              <Link href={`/appointments?patientId=${patient.id}&open=true`}>
                <Plus className="h-3.5 w-3.5" /> Book Appointment
              </Link>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No appointments on record for this patient.
            </div>
          ) : (
            <div className="space-y-2.5">
              {appointments.slice(0, 3).map((apt) => (
                <div
                  key={apt.id}
                  className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {apt.service?.name || "Doctor Consultation"}
                      </span>
                      <span className="font-mono text-muted-foreground">({apt.appointmentCode})</span>
                      <Badge
                        variant="secondary"
                        className={appointmentStatusColors[apt.status] || "bg-muted"}
                      >
                        {appointmentStatusLabels[apt.status] || apt.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {apt.source === "WEBSITE" ? "🌐 Website" : "🏥 Clinic"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Clock className="h-3 w-3 text-primary" /> {formatDateTime(apt.scheduledAt)}
                      </span>
                      <span>·</span>
                      <span>Dr. {apt.doctor.name}</span>
                      {apt.reason && (
                        <>
                          <span>·</span>
                          <span className="italic">Note: {apt.reason}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      nativeButton={false}
                      render={
                        <Link href={`/patients/${patient.id}/encounters/new?appointmentId=${apt.id}`}>
                          <Stethoscope className="h-3 w-3" /> Start EMR
                        </Link>
                      }
                    />
                  </div>
                </div>
              ))}

              {appointments.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Showing latest 3 of {appointments.length} appointments. View the Appointments tab for complete history.
                </p>
              )}
            </div>
          )}

          {/* Follow-ups strip */}
          {followUps && followUps.length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-purple-600" />
                <span className="font-semibold text-xs text-foreground">Scheduled Follow-ups:</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {followUps.map((f) => (
                  <div key={f.id} className="p-2 rounded border bg-purple-50/40 dark:bg-purple-950/20 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-medium text-foreground">Due: {formatDate(f.dueDate)}</span>
                      {f.notes && <p className="text-muted-foreground truncate max-w-xs">{f.notes}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {followUpStatusLabels[f.status] || f.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Previous Consultations (Encounters) History ──────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Previous Consultations & Clinical History</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" nativeButton={false} render={<Link href={`/patients/${patient.id}/encounters/new`}>+ New Consultation</Link>} />
        </CardHeader>
        <CardContent className="space-y-3">
          {encounters.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No previous consultations recorded for this patient.
            </div>
          ) : (
            encounters.map((e) => {
              const primaryDx = e.diagnoses.find((d) => d.type === "PRIMARY") ?? e.diagnoses[0]
              const latestVitals = e.vitals && e.vitals.length > 0 ? e.vitals[0] : null
              const totalMeds = e.prescriptions?.reduce((acc, p) => acc + (p.items?.length || 0), 0) || 0

              return (
                <div
                  key={e.id}
                  className="rounded-lg border bg-card p-4 hover:border-primary/40 transition-colors space-y-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          Dr. {e.doctor?.name || "Consultant"}
                        </span>
                        {e.doctor?.specialization && (
                          <Badge variant="outline" className="text-xs">
                            {e.doctor.specialization}
                          </Badge>
                        )}
                        <Badge variant={e.status === "FINALIZED" ? "default" : "secondary"} className="text-xs">
                          {e.status === "FINALIZED" ? "Signed & Finalized" : "Draft"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(e.encounterDate)}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs self-start sm:self-auto"
                      nativeButton={false}
                      render={
                        <Link href={`/patients/${patient.id}/encounters/${e.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          View Consultation
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      }
                    />
                  </div>

                  {/* Complaints & Diagnoses */}
                  <div className="grid gap-2 sm:grid-cols-2 text-xs pt-1">
                    {e.chiefComplaints && e.chiefComplaints.length > 0 && (
                      <div className="p-2.5 rounded bg-muted/40 border">
                        <span className="font-semibold text-foreground">Chief Complaints:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {e.chiefComplaints.map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {e.diagnoses && e.diagnoses.length > 0 && (
                      <div className="p-2.5 rounded bg-muted/40 border">
                        <span className="font-semibold text-foreground">Diagnosis:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {e.diagnoses.map((d) => (
                            <Badge key={d.id} variant="outline" className="text-xs">
                              {d.description} {d.icdCode ? `(${d.icdCode})` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vitals Summary */}
                  {latestVitals && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded border border-dashed">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-primary" /> Vitals:
                      </span>
                      {latestVitals.bpSystolic && latestVitals.bpDiastolic && (
                        <span>BP: <strong>{latestVitals.bpSystolic}/{latestVitals.bpDiastolic}</strong> mmHg</span>
                      )}
                      {latestVitals.pulseBpm && <span>Pulse: <strong>{latestVitals.pulseBpm}</strong> bpm</span>}
                      {latestVitals.weightKg && <span>Weight: <strong>{String(latestVitals.weightKg)}</strong> kg</span>}
                      {latestVitals.temperatureC && <span>Temp: <strong>{String(latestVitals.temperatureC)}</strong> °C</span>}
                      {latestVitals.bmi && <span>BMI: <strong>{String(latestVitals.bmi)}</strong></span>}
                    </div>
                  )}

                  {/* Prescribed Medications in this encounter */}
                  {totalMeds > 0 && (
                    <div className="text-xs text-muted-foreground pt-1 border-t flex items-center gap-2">
                      <Pill className="h-3.5 w-3.5 text-teal-600" />
                      <span>
                        <strong className="text-foreground">{totalMeds} medication(s)</strong> prescribed during this consultation.
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* ── 4. Prescriptions & Medications ─────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-base font-semibold">Prescriptions & Medication History</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{prescriptions.length} Prescription(s)</span>
        </CardHeader>
        <CardContent>
          {prescriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No prescriptions on file yet.</p>
          ) : (
            <div className="space-y-4">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="rounded-lg border p-3.5 space-y-2.5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Dr. {rx.doctor?.name || "Consultant"} · {formatDate(rx.issuedAt || new Date())}
                      </p>
                      {rx.diagnosis && <p className="text-xs text-muted-foreground">For: {rx.diagnosis}</p>}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {rx.items.length} Medicine(s)
                    </Badge>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {rx.items.map((item) => (
                      <div key={item.id} className="bg-background rounded border p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{item.medicineName}</span>
                          {item.dosage && <Badge variant="secondary" className="text-xs">{item.dosage}</Badge>}
                        </div>
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                          <span>{item.frequency || "As advised"} · {item.duration || "Duration unstated"}</span>
                        </div>
                        {item.instructions && (
                          <p className="text-muted-foreground/80 italic text-[11px]">Note: {item.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {rx.notes && (
                    <p className="text-xs text-muted-foreground italic bg-background p-2 rounded border">
                      Advice: {rx.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Documents, Diagnostic Reports & Shared Records ──────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-base font-semibold">Shared Documents, Lab Reports & Medical Records</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{totalDocuments} item(s)</span>
        </CardHeader>
        <CardContent>
          {totalDocuments === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No documents or diagnostic reports uploaded yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {patient.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors group"
                >
                  <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {doc.title}
                    </p>
                    <Badge variant="outline" className="text-[11px] mt-1">
                      {documentCategoryLabels[doc.category]}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.uploadedAt)}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}

              {reports.map((rep) => (
                <div key={rep.id} className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <FileText className="h-8 w-8 text-teal-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{rep.title}</p>
                    <Badge variant="secondary" className="text-[11px] mt-1">
                      {rep.type} {rep.modality ? `· ${rep.modality}` : ""}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(rep.reportDate)}</p>
                  </div>
                </div>
              ))}

              {records?.referralNotes?.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <FileText className="h-8 w-8 text-purple-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">Referral to {rec.toSpecialty || "Specialist"}</p>
                    <Badge variant="outline" className="text-[11px] mt-1">
                      {rec.urgency}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(rec.createdAt)}</p>
                  </div>
                </div>
              ))}

              {records?.certificates?.map((cert) => (
                <div key={cert.id} className="flex items-start gap-3 rounded-lg border p-3 bg-muted/20">
                  <FileText className="h-8 w-8 text-indigo-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{cert.type} Certificate</p>
                    <Badge variant="outline" className="text-[11px] mt-1">
                      {cert.type}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(cert.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 6. Allergies, Conditions, Insurance & Emergency Contacts ────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Allergies & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patient.allergies.length === 0 && patient.chronicDiseases.length === 0 && (
              <p className="text-muted-foreground">None recorded</p>
            )}
            {patient.allergies.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <span>{a.allergen}</span>
                <Badge variant="secondary" className={alertSeverityColors[a.severity]}>
                  {alertSeverityLabels[a.severity]}
                </Badge>
              </div>
            ))}
            {patient.chronicDiseases.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span>{c.name}</span>
                <Badge variant="outline">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Insurance Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {!primaryInsurance && <p className="text-muted-foreground">No insurance on file</p>}
            {primaryInsurance && (
              <>
                <p className="font-medium">{primaryInsurance.provider}</p>
                <p className="text-muted-foreground">Policy: {primaryInsurance.policyNumber}</p>
                {primaryInsurance.validTo && (
                  <p className="text-muted-foreground">Valid till {formatDate(primaryInsurance.validTo)}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {!primaryEmergencyContact && <p className="text-muted-foreground">None recorded</p>}
            {primaryEmergencyContact && (
              <>
                <p className="font-medium">{primaryEmergencyContact.name}</p>
                <p className="text-muted-foreground">
                  {primaryEmergencyContact.relation} · {primaryEmergencyContact.phone}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 7. Registration & Family Metadata ──────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registration & Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-muted-foreground">
            <p>Registered on {formatDate(patient.createdAt)}</p>
            {patient.registeredBy && <p>By {patient.registeredBy.name}</p>}
            <p>
              {[patient.addressLine1, patient.addressLine2, patient.city, patient.state, patient.postalCode]
                .filter(Boolean)
                .join(", ") || "No address on file"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Family Members</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {patient.familyMembers.length === 0 && <p className="text-muted-foreground">None recorded</p>}
            {patient.familyMembers.map((f) => (
              <div key={f.id} className="flex justify-between">
                <span>{f.name}</span>
                <span className="text-muted-foreground">{f.relation}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
