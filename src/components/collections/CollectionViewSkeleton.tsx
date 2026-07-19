"use client"

import type { ReactNode } from "react"

import { DataTableSkeleton } from "./DataTable"
import { useCollectionView } from "./useCollectionView"

export function CollectionViewSkeleton({
  screenKey,
  rows,
  children,
}: {
  screenKey: string
  rows?: number
  children: ReactNode
}) {
  const [view] = useCollectionView(screenKey)
  return view === "table" ? <DataTableSkeleton rows={rows} /> : children
}
