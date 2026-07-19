"use client"

import { ChevronDownIcon, ChevronUpIcon, EyeOffIcon } from "lucide-react"

import { FadeInImage } from "./FadeInImage"
import { Badge } from "@/components/ui/badge"
import { IconButton } from "@/components/ui/icon-button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { gridBadge, type EditorPage } from "@/lib/pagesEditor"
import type { PageGenState } from "@/hooks/usePageGeneration"

function Thumbnail({
  page,
  genState,
}: {
  page: EditorPage
  genState: PageGenState
}) {
  const busy = genState === "queued" || genState === "generating"

  if (busy) {
    return <Skeleton className="aspect-square w-full rounded-md" />
  }

  if (page.selectedImageUrl) {
    return (
      <FadeInImage
        src={page.selectedImageUrl}
        alt={page.text || "Page image"}
        className="aspect-square w-full rounded-md"
        imageClassName="object-cover"
      />
    )
  }

  return (
    <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed bg-muted/40 text-xs text-muted-foreground">
      Open to generate or upload
    </div>
  )
}

export function PageGrid({
  pages,
  selection,
  genStates,
  onToggleSelect,
  onFocus,
  onMove,
}: {
  pages: EditorPage[]
  selection: Set<string>
  genStates: Record<string, PageGenState>
  onToggleSelect: (pageId: string) => void
  onFocus: (pageId: string) => void
  onMove: (pageId: string, dir: 1 | -1) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {pages.map((page, index) => {
        const genState = genStates[page.id] ?? "idle"
        const badge = gridBadge(genState)
        const isCover = page.kind === "COVER"
        return (
          <Card key={page.id} className="gap-2 p-3">
            <div className="flex items-center justify-between">
              <Checkbox
                checked={selection.has(page.id)}
                onCheckedChange={() => onToggleSelect(page.id)}
                aria-label={`Select ${isCover ? "cover" : `page ${index}`}`}
              />
              <div className="flex items-center gap-1">
                {page.hidden && (
                  <Badge variant="outline" className="gap-1">
                    <EyeOffIcon className="size-3" />
                    Hidden
                  </Badge>
                )}
                {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onFocus(page.id)}
              className="block w-full text-left"
            >
              <Thumbnail page={page} genState={genState} />
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {isCover ? "Cover" : `Page ${index}`}
                {page.text ? ` · ${page.text}` : ""}
              </p>
            </button>
            {!isCover && (
              <div className="flex justify-end gap-1">
                <IconButton
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  label="Move page up"
                  onClick={() => onMove(page.id, -1)}
                >
                  <ChevronUpIcon className="size-4" />
                </IconButton>
                <IconButton
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  label="Move page down"
                  onClick={() => onMove(page.id, 1)}
                >
                  <ChevronDownIcon className="size-4" />
                </IconButton>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
