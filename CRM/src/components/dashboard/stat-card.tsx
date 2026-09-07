import { type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: "default" | "info" | "accent" | "warning" | "danger" | "success"
  hint?: string
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    info: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    accent: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 py-3.5 sm:gap-4 sm:py-5">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl", toneClasses[tone])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-tight sm:text-2xl">{value}</p>
          <p className="text-xs text-muted-foreground leading-snug sm:text-sm">{label}</p>
          {hint && <p className="text-xs text-muted-foreground/80 mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
