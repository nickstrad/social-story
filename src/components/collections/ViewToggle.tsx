"use client"

import { LayoutGridIcon, TableIcon } from "lucide-react"

import type { CollectionView } from "./useCollectionView"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const views = [
  { value: "grid", label: "Grid view", icon: LayoutGridIcon },
  { value: "table", label: "Table view", icon: TableIcon },
] as const

export function ViewToggle({
  value,
  onValueChange,
}: {
  value: CollectionView
  onValueChange: (value: CollectionView) => void
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(selected) => {
        const next = selected[0] as CollectionView | undefined
        if (next) onValueChange(next)
      }}
      variant="outline"
      spacing={0}
      aria-label="Collection view"
    >
      {views.map(({ value: view, label, icon: Icon }) => (
        <Tooltip key={view}>
          <TooltipTrigger
            render={
              <ToggleGroupItem value={view} aria-label={label} size="sm" />
            }
          >
            <Icon />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
