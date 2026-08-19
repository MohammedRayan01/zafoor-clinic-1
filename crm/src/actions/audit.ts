"use server"

import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { serializeDecimal } from "@/lib/serialize"

export async function getAuditLogs(params?: {
  action?: string
  entityType?: string
  userId?: string
  query?: string
  page?: number
  pageSize?: number
}) {
  await requireRole("ADMIN")
  const { action, entityType, userId, query, page = 1, pageSize = 30 } = params || {}

  const where: Record<string, unknown> = {}
  if (action && action !== "ALL") where.action = action
  if (entityType && entityType !== "ALL") where.entityType = entityType
  if (userId) where.userId = userId
  if (query) {
    where.OR = [
      { userName: { contains: query, mode: "insensitive" } },
      { action: { contains: query, mode: "insensitive" } },
      { entityType: { contains: query, mode: "insensitive" } },
      { entityId: { contains: query, mode: "insensitive" } },
    ]
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs: logs.map((l) => ({
      ...l,
      user: l.user ? serializeDecimal(l.user, ["consultationFee"]) : null,
    })),
    total,
    page,
    pageSize,
  }
}
