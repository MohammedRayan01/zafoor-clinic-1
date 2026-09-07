"use server"

import { revalidatePath } from "next/cache"
import { startOfDay, endOfDay, subDays, differenceInCalendarDays, format } from "date-fns"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth"
import { toPlain } from "@/lib/serialize"
import { expenseSchema, type ExpenseInput } from "@/lib/validations/billing"
import { classifyServiceName } from "@/lib/care-category"
import { careCategoryLabels } from "@/lib/labels"

// ── Expenses ────────────────────────────────────────────────────────────

export async function addExpense(input: ExpenseInput) {
  const data = expenseSchema.parse(input)
  const user = await requireRole("ADMIN", "BILLING")
  const expense = await prisma.expense.create({
    data: {
      ...data,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
      recordedById: user.id,
    },
  })
  revalidatePath("/finance/expenses")
  revalidatePath("/finance/dashboard")
  return toPlain(expense)
}

export async function deleteExpense(id: string) {
  await requireRole("ADMIN", "BILLING")
  await prisma.expense.delete({ where: { id } })
  revalidatePath("/finance/expenses")
  revalidatePath("/finance/dashboard")
}

export async function getExpenses(params: { category?: string; from?: Date; to?: Date }) {
  const where: Record<string, unknown> = {}
  if (params.category) where.category = params.category
  if (params.from || params.to) {
    where.expenseDate = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    }
  }
  const expenses = await prisma.expense.findMany({ where, include: { recordedBy: true }, orderBy: { expenseDate: "desc" } })
  return toPlain(expenses)
}

// ── Outstanding dues ────────────────────────────────────────────────────

export async function getOutstandingDues() {
  const bills = await prisma.bill.findMany({
    where: { balanceDue: { gt: 0 }, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
    include: { patient: true, service: true },
    orderBy: { issuedAt: "asc" },
  })

  const now = new Date()
  const buckets = { current: 0, days30: 0, days60: 0, days90plus: 0 }
  const rows = bills.map((b) => {
    const age = differenceInCalendarDays(now, b.issuedAt)
    const balance = Number(b.balanceDue)
    if (age <= 30) buckets.current += balance
    else if (age <= 60) buckets.days30 += balance
    else if (age <= 90) buckets.days60 += balance
    else buckets.days90plus += balance
    return { ...b, ageDays: age }
  })

  return { rows, buckets, totalOutstanding: rows.reduce((sum, r) => sum + Number(r.balanceDue), 0) }
}

// ── Revenue dashboard ───────────────────────────────────────────────────

export async function getRevenueDashboard() {
  const now = new Date()
  const monthStart = startOfDay(subDays(now, 29))

  const [bills, payments, expensesThisMonth, outstandingTotal] = await Promise.all([
    prisma.bill.findMany({
      where: { issuedAt: { gte: monthStart }, status: { not: "CANCELLED" } },
      select: { issuedAt: true, netAmount: true, taxAmount: true, service: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: monthStart }, status: "SUCCESS" },
      select: { paidAt: true, amount: true, method: true },
    }),
    prisma.expense.aggregate({
      where: { expenseDate: { gte: startOfDay(subDays(now, 29)) } },
      _sum: { amount: true },
    }),
    prisma.bill.aggregate({
      where: { balanceDue: { gt: 0 }, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
      _sum: { balanceDue: true },
    }),
  ])

  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const todayRevenue = bills
    .filter((b) => b.issuedAt >= todayStart && b.issuedAt <= todayEnd)
    .reduce((sum, b) => sum + Number(b.netAmount), 0)
  const todayCollected = payments
    .filter((p) => p.paidAt >= todayStart && p.paidAt <= todayEnd)
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const monthRevenue = bills.reduce((sum, b) => sum + Number(b.netAmount), 0)
  const monthCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const monthGst = bills.reduce((sum, b) => sum + Number(b.taxAmount), 0)

  const revenueByDay: { date: string; revenue: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const day = subDays(now, i)
    const dayStart = startOfDay(day)
    const dayEnd = endOfDay(day)
    const revenue = bills
      .filter((b) => b.issuedAt >= dayStart && b.issuedAt <= dayEnd)
      .reduce((sum, b) => sum + Number(b.netAmount), 0)
    revenueByDay.push({ date: format(day, "dd MMM"), revenue })
  }

  const revenueByService: Record<string, number> = {}
  for (const b of bills) {
    const label = careCategoryLabels[classifyServiceName(b.service?.name)]
    revenueByService[label] = (revenueByService[label] ?? 0) + Number(b.netAmount)
  }

  const collectionsByMethod: Record<string, number> = {}
  for (const p of payments) {
    collectionsByMethod[p.method] = (collectionsByMethod[p.method] ?? 0) + Number(p.amount)
  }

  return {
    todayRevenue,
    todayCollected,
    monthRevenue,
    monthCollected,
    monthGst,
    monthExpenses: Number(expensesThisMonth._sum.amount ?? 0),
    totalOutstanding: Number(outstandingTotal._sum.balanceDue ?? 0),
    revenueByDay,
    revenueByService,
    collectionsByMethod,
  }
}

// ── Financial report ────────────────────────────────────────────────────

export async function getFinancialReport(from: Date, to: Date) {
  const [bills, payments, expenses] = await Promise.all([
    prisma.bill.findMany({
      where: { issuedAt: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      include: { service: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: from, lte: to }, status: "SUCCESS" },
    }),
    prisma.expense.findMany({ where: { expenseDate: { gte: from, lte: to } } }),
  ])

  const totalRevenue = bills.reduce((sum, b) => sum + Number(b.netAmount), 0)
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const totalDiscount = bills.reduce((sum, b) => sum + Number(b.discountAmount), 0)
  const totalTax = bills.reduce((sum, b) => sum + Number(b.taxAmount), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const revenueByService: Record<string, number> = {}
  for (const b of bills) {
    const label = careCategoryLabels[classifyServiceName(b.service?.name)]
    revenueByService[label] = (revenueByService[label] ?? 0) + Number(b.netAmount)
  }

  const paymentsByMethod: Record<string, number> = {}
  for (const p of payments) paymentsByMethod[p.method] = (paymentsByMethod[p.method] ?? 0) + Number(p.amount)

  const expensesByCategory: Record<string, number> = {}
  for (const e of expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + Number(e.amount)

  return {
    from,
    to,
    billCount: bills.length,
    totalRevenue,
    totalCollected,
    totalDiscount,
    totalTax,
    totalExpenses,
    netProfit: totalCollected - totalExpenses,
    revenueByService,
    paymentsByMethod,
    expensesByCategory,
  }
}
