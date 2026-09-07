"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getPatients } from "@/actions/patients"
import { patientDisplayName } from "@/lib/format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PatientOption = { id: string; name: string; uhid: string; phone: string }

export function PatientPicker({
  value,
  onChange,
  initial,
}: {
  value: string
  onChange: (patientId: string) => void
  initial?: PatientOption | null
}) {
  const [patients, setPatients] = useState<PatientOption[]>(
    initial ? [initial] : []
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getPatients({ pageSize: 500 }).then(({ patients: list }) => {
      if (cancelled) return
      setPatients(
        list.map((p) => ({ id: p.id, name: patientDisplayName(p), uhid: p.uhid, phone: p.phone }))
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-1.5">
      <Select value={value || undefined} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading patients…" : "Select a patient"} />
        </SelectTrigger>
        <SelectContent>
          {!loading && patients.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No patients registered yet.</div>
          )}
          {patients.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} — {p.uhid} — {p.phone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link href="/patients/new" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
        + Register a new patient (opens in a new tab)
      </Link>
    </div>
  )
}
