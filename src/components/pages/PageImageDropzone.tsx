"use client"

import type { DragEvent } from "react"
import { ImagePlusIcon, UploadCloudIcon, UploadIcon } from "lucide-react"

import { FadeInImage } from "./FadeInImage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PageImageUploadState } from "@/hooks/usePageImageUpload"
import { cn } from "@/lib/utils"
import type { PageImageSource } from "@/server/domain/types"

function UploadConfirmation({
  previewUrl,
  onConfirm,
  onCancel,
}: {
  previewUrl: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-3 z-10 grid place-items-center rounded-lg bg-background/95 p-4 text-center shadow-lg backdrop-blur-sm">
      <div className="grid max-w-sm justify-items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        <img
          src={previewUrl}
          alt="Image selected for upload"
          className="size-28 rounded-lg object-contain"
        />
        <div className="grid gap-1">
          <p className="font-medium">Use this image for this page?</p>
          <p className="text-sm text-muted-foreground">
            Your previous versions stay in the strip.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onConfirm}>
            <UploadIcon />
            Confirm upload
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PageImageDropzone({
  url,
  source,
  generationBusy,
  uploadState,
  dragging,
  previewUrl,
  onDragState,
  onDrop,
  onOpenPicker,
  onConfirm,
  onCancel,
}: {
  url: string | null
  source?: PageImageSource
  generationBusy: boolean
  uploadState: PageImageUploadState
  dragging: boolean
  previewUrl: string | null
  onDragState: (dragging: boolean) => void
  onDrop: (file: File) => void
  onOpenPicker: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (uploadState === "uploading") {
    return (
      <div className="relative aspect-square w-full">
        <Skeleton className="size-full rounded-lg" />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-muted-foreground">
          Uploading…
        </span>
      </div>
    )
  }
  if (generationBusy) {
    return <Skeleton className="aspect-square w-full rounded-lg" />
  }

  function takeDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    onDragState(false)
    const file = event.dataTransfer.files[0]
    if (file) onDrop(file)
  }

  return (
    <div
      className="relative aspect-square w-full"
      onDragEnter={(event) => {
        event.preventDefault()
        onDragState(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          onDragState(false)
        }
      }}
      onDrop={takeDrop}
    >
      {url ? (
        <FadeInImage
          src={url}
          alt="Current page image"
          className="size-full rounded-lg"
          imageClassName="object-contain"
        />
      ) : (
        <div
          className={cn(
            "flex size-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground transition-colors",
            dragging && "border-primary bg-muted"
          )}
        >
          <ImagePlusIcon className="size-8" />
          <div>
            <p className="font-medium text-foreground">No image yet</p>
            <p>Generate one, or drag an image here.</p>
          </div>
          <Button type="button" variant="secondary" onClick={onOpenPicker}>
            <UploadCloudIcon />
            Upload
          </Button>
        </div>
      )}
      {url && source && (
        <Badge variant="secondary" className="absolute top-3 right-3">
          {source === "UPLOAD" ? "Uploaded" : "AI-generated"}
        </Badge>
      )}
      {dragging && url && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 font-medium">
          Drop to choose this image
        </div>
      )}
      {previewUrl && (
        <UploadConfirmation
          previewUrl={previewUrl}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
