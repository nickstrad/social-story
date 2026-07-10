"use client"

import { SparklesIcon } from "lucide-react"

import { AddPageButton } from "./AddPageButton"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { TaskProgress } from "@/server/domain/taskMachine"

export function PageGridToolbar({
  selectedCount,
  isAllSelected,
  progress,
  onSelectAll,
  onSelectNone,
  onGenerate,
  onAddPage,
}: {
  selectedCount: number
  isAllSelected: boolean
  progress: TaskProgress
  onSelectAll: () => void
  onSelectNone: () => void
  onGenerate: () => void
  onAddPage: () => void
}) {
  const active = progress.pending + progress.running
  const total = active + progress.done + progress.failed
  const percent = total > 0 ? Math.round((progress.done / total) * 100) : 0

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={isAllSelected ? onSelectNone : onSelectAll}
        >
          {isAllSelected ? "Select none" : "Select all"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selectedCount} selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          <AddPageButton onAdd={onAddPage} />
          <Button size="sm" disabled={selectedCount === 0} onClick={onGenerate}>
            <SparklesIcon />
            Generate selected ({selectedCount})
          </Button>
        </div>
      </div>
      {active > 0 && (
        <div className="grid gap-1">
          <Progress value={percent} />
          <p className="text-xs text-muted-foreground">
            {progress.done}/{total} generated
            {progress.failed > 0 ? ` · ${progress.failed} failed` : ""}
          </p>
        </div>
      )}
    </div>
  )
}
