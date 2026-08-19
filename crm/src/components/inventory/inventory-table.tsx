"use client"

import { useState } from "react"
import Link from "next/link"
import { Search, AlertTriangle, CheckCircle2, XCircle, MoreVertical, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StockInDialog } from "@/components/inventory/stock-in-dialog"
import { StockOutDialog } from "@/components/inventory/stock-out-dialog"
import { MedicineFormDialog } from "@/components/inventory/medicine-form-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type InventoryItem = {
  id: string
  name: string
  category: string
  manufacturer: string | null
  sku: string
  unit: string
  description: string | null
  currentStock: number
  referenceStock: number
  lowStockThresholdPercent: number
  lowStockThresholdQty: number
  unitPrice: number | null
  active: boolean
  isLowStock: boolean
  activeAlert: { id: string; status: string; severity: string } | null
}

export function InventoryTable({
  items,
  userRole,
}: {
  items: InventoryItem[]
  userRole: string
}) {
  const [query, setQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("ALL")

  const categories = ["ALL", ...Array.from(new Set(items.map((i) => i.category)))]

  const filtered = items.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.sku.toLowerCase().includes(query.toLowerCase()) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(query.toLowerCase()))
    return matchesCategory && matchesQuery
  })

  const isAdmin = userRole === "ADMIN"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by medicine, SKU, brand…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Medicine / Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Threshold</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No inventory items found matching your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isOutOfStock = item.currentStock === 0
                  const isLow = item.isLowStock && !isOutOfStock

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/inventory/${item.id}`} className="hover:underline text-foreground">
                          {item.name}
                        </Link>
                        {item.manufacturer && (
                          <span className="block text-xs text-muted-foreground font-normal">
                            {item.manufacturer}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        <span className={isOutOfStock ? "text-destructive" : isLow ? "text-amber-600" : ""}>
                          {item.currentStock} {item.unit}s
                        </span>
                        <span className="block text-xs text-muted-foreground font-normal">
                          Ref: {item.referenceStock} {item.unit}s
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        ≤ {item.lowStockThresholdQty} {item.unit}s
                        <span className="block text-[11px] text-muted-foreground/80">
                          ({item.lowStockThresholdPercent}%)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isOutOfStock ? (
                          <Badge variant="destructive" className="gap-1 text-xs font-medium">
                            <XCircle className="h-3 w-3" /> Out of Stock
                          </Badge>
                        ) : isLow ? (
                          <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                            <AlertTriangle className="h-3 w-3" /> Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30">
                            <CheckCircle2 className="h-3 w-3" /> In Stock
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Stock In & Out available for both Admin and Receptionist */}
                          <StockInDialog item={item} />
                          <StockOutDialog item={item} />

                          {/* Admin only metadata actions */}
                          {isAdmin ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem render={<Link href={`/inventory/${item.id}`} className="flex items-center gap-2 w-full"><Eye className="h-4 w-4" /> View Ledger</Link>} />
                                <MedicineFormDialog
                                  item={item}
                                  trigger={
                                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted rounded-sm">
                                      Edit Metadata
                                    </div>
                                  }
                                />
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              nativeButton={false}
                              render={
                                <Link href={`/inventory/${item.id}`}>
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Link>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
