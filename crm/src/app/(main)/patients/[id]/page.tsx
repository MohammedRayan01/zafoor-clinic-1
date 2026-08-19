import { notFound } from "next/navigation"
import { getPatientById, listAllTags, getPatientPrescriptions } from "@/actions/patients"
import { getPatientTimeline } from "@/actions/timeline"
import { getPatientCrmData } from "@/actions/crm"
import { getAllStaff } from "@/lib/auth"
import { getEncountersForPatient } from "@/actions/encounters"
import { getClinicalHistory } from "@/actions/history"
import { getClinicalReports } from "@/actions/reports"
import { getPatientRecords } from "@/actions/records"
import { getPatientBillingSummary } from "@/actions/billing"
import { patientDisplayName } from "@/lib/format"
import { PatientHeader } from "@/components/patients/profile/patient-header"
import { OverviewTab } from "@/components/patients/profile/overview-tab"
import { FamilyInsuranceTab } from "@/components/patients/profile/family-insurance-tab"
import { MedicalTab } from "@/components/patients/profile/medical-tab"
import { DocumentsTab } from "@/components/patients/profile/documents-tab"
import { PreferencesTab } from "@/components/patients/profile/preferences-tab"
import { TimelineTab } from "@/components/patients/profile/timeline-tab"
import { CrmTab } from "@/components/patients/profile/crm-tab"
import { EncountersTab } from "@/components/emr/encounters-tab"
import { PrescriptionsTab } from "@/components/patients/profile/prescriptions-tab"
import { ClinicalHistoryTab } from "@/components/emr/clinical-history-tab"
import { RecordsTab } from "@/components/emr/records-tab"
import { PatientBillingTab } from "@/components/billing/patient-billing-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const patient = await getPatientById(id)
  if (!patient) notFound()

  const [
    timeline,
    crmData,
    staff,
    allTags,
    encounters,
    prescriptions,
    clinicalHistory,
    reports,
    records,
    billingSummary,
  ] = await Promise.all([
    getPatientTimeline(id),
    getPatientCrmData(id),
    getAllStaff(),
    listAllTags(),
    getEncountersForPatient(id),
    getPatientPrescriptions(id),
    getClinicalHistory(id),
    getClinicalReports(id),
    getPatientRecords(id),
    getPatientBillingSummary(id),
  ])

  const fullName = patientDisplayName(patient)

  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} allTags={allTags} />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="encounters">Consultations ({encounters.length})</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions ({prescriptions.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({patient.documents.length})</TabsTrigger>
          <TabsTrigger value="records">Reports & Records ({reports.length + records.referralNotes.length + records.certificates.length})</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="family">Family & Insurance</TabsTrigger>
          <TabsTrigger value="medical">Medical History</TabsTrigger>
          <TabsTrigger value="history">Clinical Details</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            patient={patient}
            encounters={encounters}
            prescriptions={prescriptions}
            reports={reports}
            records={records}
          />
        </TabsContent>
        <TabsContent value="encounters" className="mt-4">
          <EncountersTab patientId={id} encounters={encounters} />
        </TabsContent>
        <TabsContent value="prescriptions" className="mt-4">
          <PrescriptionsTab
            patientName={fullName}
            uhid={patient.uhid}
            prescriptions={prescriptions}
          />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab patient={patient} />
        </TabsContent>
        <TabsContent value="records" className="mt-4">
          <RecordsTab patientId={id} reports={reports} records={records} />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <PatientBillingTab patientId={id} summary={billingSummary} />
        </TabsContent>
        <TabsContent value="family" className="mt-4">
          <FamilyInsuranceTab patient={patient} />
        </TabsContent>
        <TabsContent value="medical" className="mt-4">
          <MedicalTab patient={patient} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ClinicalHistoryTab patientId={id} data={clinicalHistory} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab events={timeline} />
        </TabsContent>
        <TabsContent value="crm" className="mt-4">
          <CrmTab patientId={id} data={crmData} staff={staff} />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <PreferencesTab patient={patient} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

