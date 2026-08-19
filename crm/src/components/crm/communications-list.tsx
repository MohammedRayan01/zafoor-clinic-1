import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatDateTime, patientDisplayName } from "@/lib/format"
import { commChannelLabels } from "@/lib/labels"
import { ArrowDownLeft, ArrowUpRight, Globe, Mail, MessageSquare } from "lucide-react"
import type { getMessages } from "@/actions/crm"

type Messages = Awaited<ReturnType<typeof getMessages>>

export function CommunicationsList({ messages }: { messages: Messages }) {
  if (messages.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No messages logged yet.</p>
  }

  return (
    <div className="divide-y">
      {messages.map((m) => {
        const isInbound = m.direction === "INBOUND"
        const isWebsiteInquiry = m.patient?.source === "WEBSITE_CONTACT" || m.subject?.toLowerCase().includes("website")

        return (
          <div key={m.id} className="flex items-start gap-4 p-4 hover:bg-muted/40 transition-colors">
            <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
              <Badge variant={isInbound ? "secondary" : "outline"} className="gap-1 text-xs">
                {isInbound ? (
                  <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-primary" />
                )}
                {commChannelLabels[m.channel] || m.channel}
              </Badge>
              {isWebsiteInquiry && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary gap-0.5">
                  <Globe className="h-2.5 w-2.5" />
                  Website
                </Badge>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link href={`/patients/${m.patientId}`} className="text-sm font-semibold hover:underline">
                    {patientDisplayName(m.patient)}
                  </Link>
                  {m.patient?.phone && (
                    <span className="text-xs text-muted-foreground">· {m.patient.phone}</span>
                  )}
                  {m.patient?.email && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">· {m.patient.email}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(m.sentAt)}</span>
              </div>

              {m.subject && <p className="text-sm font-medium mt-1 text-foreground">{m.subject}</p>}
              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{m.body}</p>

              <div className="flex items-center justify-between mt-2 pt-1 text-xs text-muted-foreground/80 border-t border-dashed border-border/50">
                <span>
                  {isInbound ? "Received from patient" : `Sent${m.sentBy ? ` by ${m.sentBy.name}` : ""}`} · {m.status}
                </span>
                {m.patient?.phone && (
                  <a
                    href={`tel:${m.patient.phone}`}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    Call Back
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
