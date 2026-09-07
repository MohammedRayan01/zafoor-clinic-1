"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PatientPicker } from "@/components/appointments/patient-picker"
import { addFollowUp } from "@/actions/crm"

type Staff = { id: string; name: string; role: string }

export function AddFollowUpDialog({ staff }: { staff: Staff[] }) {
  const [open, setOpen] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [assignedToId, setAssignedToId] = useState("NONE")
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5"><Plus className="h-4 w-4" />Add Follow-up</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Add Follow-up</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            if (!patientId) {
              toast.error("Select a patient")
              return
            }
            const dueDate = fd.get("dueDate")
            if (!dueDate) {
              toast.error("Due date is required")
              return
            }
            const reason = String(fd.get("reason") || "").trim()
            if (!reason) {
              toast.error("Reason is required")
              return
            }
            startTransition(async () => {
              try {
                await addFollowUp(patientId, {
                  dueDate: new Date(String(dueDate)),
                  reason,
                  assignedToId: assignedToId === "NONE" ? undefined : assignedToId,
                  notes: String(fd.get("notes") || "") || undefined,
                })
                toast.success("Follow-up added")
                setOpen(false)
                setPatientId("")
                setAssignedToId("NONE")
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not add follow-up")
              }
            })
          }}
        >
          <div className="space-y-1.5">
            <Label>Patient</Label>
            <PatientPicker value={patientId} onChange={setPatientId} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due date *</Label>
            <Input id="dueDate" name="dueDate" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-reason">Reason *</Label>
            <Input id="fu-reason" name="reason" placeholder="e.g. Post-treatment review" required />
          </div>
          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select
              items={{ NONE: "Unassigned", ...Object.fromEntries(staff.map((s) => [s.id, s.name])) }}
              value={assignedToId}
              onValueChange={(value) => setAssignedToId(value ?? "NONE")}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Unassigned</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-notes">Notes</Label>
            <Textarea id="fu-notes" name="notes" />
          </div>
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Add"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
