"use client"

import { useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * An image that shows a shape-matched skeleton until the blob finishes loading,
 * then fades in. Shared by the grid thumbnails, the focused preview, and the
 * variant strip so the load-state idiom lives in one place.
 */
export function FadeInImage({
  src,
  alt,
  className,
  imageClassName,
}: {
  src: string
  alt: string
  className?: string
  imageClassName?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {!loaded && <Skeleton className="absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={cn(
          "size-full transition-opacity",
          loaded ? "opacity-100" : "opacity-0",
          imageClassName
        )}
      />
    </div>
  )
}
