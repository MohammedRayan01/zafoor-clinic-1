import { getFollowUps } from "@/actions/crm"
import { getAllStaff } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { FollowUpsFilters } from "@/components/crm/follow-ups-filters"
import { FollowUpsList } from "@/components/crm/follow-ups-list"
import { AddFollowUpDialog } from "@/components/crm/add-follow-up-dialog"

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedToId?: string }>
}) {
  const sp = await searchParams
  const [followUps, staff] = await Promise.all([
    getFollowUps({ status: sp.status, assignedToId: sp.assignedToId }),
    getAllStaff(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">{followUps.length} follow-up{followUps.length === 1 ? "" : "s"}</p>
        </div>
        <AddFollowUpDialog staff={staff} />
      </div>

      <FollowUpsFilters staff={staff} />

      <Card>
        <CardContent className="p-0">
          <FollowUpsList followUps={followUps} />
        </CardContent>
      </Card>
    </div>
  )
}
