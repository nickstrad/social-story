"use client"

import { FadeInImage } from "./FadeInImage"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { ClientPageImage as PageImage } from "@/server/domain/types"
import { cn } from "@/lib/utils"

function VariantThumb({
  image,
  selected,
  onSelect,
}: {
  image: PageImage
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "size-16 shrink-0 overflow-hidden rounded-md border-2",
        selected ? "border-primary" : "border-transparent"
      )}
    >
      <FadeInImage
        src={image.url}
        alt={`Variant ${image.variant}`}
        className="size-full"
        imageClassName="object-cover"
      />
    </button>
  )
}

/**
 * Horizontal strip of a page's image variants (newest-first). Shows a
 * placeholder skeleton while variants load, plus an extra skeleton thumb while
 * a new one is generating.
 */
export function VariantStrip({
  images,
  selectedImageId,
  loading,
  busy,
  onSelect,
}: {
  images: PageImage[]
  selectedImageId: string | null
  loading: boolean
  busy: boolean
  onSelect: (pageImageId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="size-16 rounded-md" />
        ))}
      </div>
    )
  }

  if (images.length === 0 && !busy) return null

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {busy && <Skeleton className="size-16 shrink-0 rounded-md" />}
        {images.map((image) => (
          <VariantThumb
            key={image.id}
            image={image}
            selected={image.id === selectedImageId}
            onSelect={() => onSelect(image.id)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
