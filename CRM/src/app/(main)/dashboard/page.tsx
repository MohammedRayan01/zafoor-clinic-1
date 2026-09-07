import Link from "next/link"
import { UserPlus, Repeat, CalendarClock, Users2, AlertTriangle, CheckSquare } from "lucide-react"
import { getDashboardStats, getRecentPatients } from "@/actions/dashboard"
import { StatCard } from "@/components/dashboard/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatTime, formatRelative, initials, patientDisplayName } from "@/lib/format"
import { appointmentStatusColors, appointmentStatusLabels, appointmentTypeLabels } from "@/lib/labels"

export default async function DashboardPage() {
  const [stats, recentPatients] = await Promise.all([getDashboardStats(), getRecentPatients(6)])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today at a glance across Zafoor Clinic.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="New Patients" value={stats.newPatientsToday} icon={UserPlus} tone="default" />
        <StatCard label="Returning Patients" value={stats.returningPatientsToday} icon={Repeat} tone="accent" />
        <StatCard label="Today's Appointments" value={stats.todayAppointmentsCount} icon={CalendarClock} tone="info" />
        <StatCard label="Waiting Queue" value={stats.waitingQueueCount} icon={Users2} tone="warning" />
        <StatCard label="Missed Appointments" value={stats.missedAppointmentsCount} icon={AlertTriangle} tone="danger" />
        <StatCard label="Follow-ups Due" value={stats.followUpsDueCount} icon={CheckSquare} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Today&apos;s Schedule</CardTitle>
            <Link href="/appointments" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.todayAppointments.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No appointments scheduled today.</p>
            )}
            {stats.todayAppointments.map((apt) => (
              <Link
                key={apt.id}
                href={`/patients/${apt.patientId}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted transition-colors"
              >
                <div className="w-16 shrink-0 text-sm font-medium tabular-nums">{formatTime(apt.scheduledAt)}</div>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{initials(patientDisplayName(apt.patient))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{patientDisplayName(apt.patient)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Dr. {apt.doctor.name} · {appointmentTypeLabels[apt.type]}
                  </p>
                </div>
                <Badge variant="secondary" className={appointmentStatusColors[apt.status]}>
                  {appointmentStatusLabels[apt.status]}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Follow-ups Due</CardTitle>
            <Link href="/follow-ups" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.followUpsDue.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">Nothing due. You&apos;re all caught up.</p>
            )}
            {stats.followUpsDue.map((f) => (
              <Link
                key={f.id}
                href={`/patients/${f.patientId}`}
                className="block rounded-lg px-2 py-2 hover:bg-muted transition-colors"
              >
                <p className="text-sm font-medium truncate">{patientDisplayName(f.patient)}</p>
                <p className="text-xs text-muted-foreground truncate">{f.reason}</p>
                <p className="text-xs text-muted-foreground/80">Due {formatRelative(f.dueDate)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recently Registered Patients</CardTitle>
          <Link href="/patients" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentPatients.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{initials(patientDisplayName(p))}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{patientDisplayName(p)}</p>
                <p className="text-xs text-muted-foreground">{p.uhid}</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
