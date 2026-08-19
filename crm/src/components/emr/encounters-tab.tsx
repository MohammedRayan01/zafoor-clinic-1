"use client"

import Link from "next/link"
import { Plus, Stethoscope, Activity, Pill, FileText, Calendar, ArrowRight, CheckCircle2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime, formatDate } from "@/lib/format"
import type { getEncountersForPatient } from "@/actions/encounters"

type Encounters = Awaited<ReturnType<typeof getEncountersForPatient>>

export function EncountersTab({ patientId, encounters }: { patientId: string; encounters: Encounters }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Clinical Consultations & Encounters</h2>
          <p className="text-sm text-muted-foreground">
            Complete record of past medical reviews, diagnoses, and treatments ({encounters.length} total).
          </p>
        </div>
        <Button
          className="gap-1.5 self-start sm:self-auto"
          nativeButton={false}
          render={
            <Link href={`/patients/${patientId}/encounters/new`}>
              <Plus className="h-4 w-4" />
              New Consultation
            </Link>
          }
        />
      </div>

      {encounters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Stethoscope className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            No consultations recorded yet for this patient.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {encounters.map((e) => {
            const latestVitals = e.vitals && e.vitals.length > 0 ? e.vitals[0] : null
            const allPrescriptions = e.prescriptions || []
            const totalMeds = allPrescriptions.reduce((acc, p) => acc + (p.items?.length || 0), 0)

            return (
              <Card key={e.id} className="overflow-hidden border-border/80 hover:border-primary/50 transition-all shadow-sm">
                <CardHeader className="bg-muted/30 pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Stethoscope className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-base text-foreground">
                            Dr. {e.doctor.name}
                          </span>
                          {e.doctor.specialization && (
                            <Badge variant="outline" className="text-xs">
                              {e.doctor.specialization}
                            </Badge>
                          )}
                          <Badge
                            variant={e.status === "FINALIZED" ? "default" : "secondary"}
                            className="gap-1 text-xs"
                          >
                            {e.status === "FINALIZED" ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Signed & Finalized
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3" /> Draft
                              </>
                            )}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateTime(e.encounterDate)}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs self-start sm:self-auto"
                      nativeButton={false}
                      render={
                        <Link href={`/patients/${patientId}/encounters/${e.id}`}>
                          Open Consultation Details
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      }
                    />
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3">
                  {/* Complaints & Diagnoses Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <span className="font-semibold text-foreground">Chief Complaints:</span>
                      {e.chiefComplaints && e.chiefComplaints.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {e.chiefComplaints.map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-xs font-normal">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-xs">General routine consultation</p>
                      )}
                    </div>

                    <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                      <span className="font-semibold text-foreground">Diagnoses:</span>
                      {e.diagnoses && e.diagnoses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {e.diagnoses.map((d) => (
                            <Badge key={d.id} variant="outline" className="text-xs font-normal">
                              <span className="font-medium">{d.description}</span>
                              {d.icdCode && <span className="ml-1 text-muted-foreground font-mono">({d.icdCode})</span>}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-xs">No specific diagnosis coded</p>
                      )}
                    </div>
                  </div>

                  {/* Vitals */}
                  {latestVitals && (
                    <div className="p-2.5 rounded-lg border border-dashed bg-muted/10 flex flex-wrap items-center gap-4 text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-primary" /> Vitals:
                      </span>
                      {latestVitals.bpSystolic && latestVitals.bpDiastolic && (
                        <span>BP: <strong>{latestVitals.bpSystolic}/{latestVitals.bpDiastolic}</strong> mmHg</span>
                      )}
                      {latestVitals.pulseBpm && <span>Pulse: <strong>{latestVitals.pulseBpm}</strong> bpm</span>}
                      {latestVitals.weightKg && <span>Weight: <strong>{String(latestVitals.weightKg)}</strong> kg</span>}
                      {latestVitals.heightCm && <span>Height: <strong>{String(latestVitals.heightCm)}</strong> cm</span>}
                      {latestVitals.temperatureC && <span>Temp: <strong>{String(latestVitals.temperatureC)}</strong> °C</span>}
                      {latestVitals.bmi && <span>BMI: <strong>{String(latestVitals.bmi)}</strong></span>}
                    </div>
                  )}

                  {/* Prescribed Medications */}
                  {totalMeds > 0 && (
                    <div className="p-3 rounded-lg border bg-teal-50/30 dark:bg-teal-950/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                          <Pill className="h-3.5 w-3.5 text-teal-600" /> Prescribed Medicines ({totalMeds}):
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {allPrescriptions.map((rx) =>
                          rx.items.map((item) => (
                            <div key={item.id} className="bg-background rounded border p-2 text-xs">
                              <span className="font-medium text-foreground">{item.medicineName}</span>
                              {item.dosage && <span className="ml-1 text-muted-foreground">({item.dosage})</span>}
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {item.frequency || "As directed"} · {item.duration || "Duration unstated"}
                                {item.instructions && ` — ${item.instructions}`}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
