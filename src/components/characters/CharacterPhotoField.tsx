"use client"

import { useState, type DragEvent } from "react"
import { ImagePlusIcon, SparklesIcon, UploadCloudIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function CharacterPhotoField({
  photoPreviewUrl,
  autofillState,
  canAutofill,
  error,
  onPickFile,
  onAutofill,
}: {
  photoPreviewUrl: string
  autofillState: "idle" | "loading" | "error"
  canAutofill: boolean
  error?: string
  onPickFile: (file: File) => void
  onAutofill: () => void
}) {
  const [dragging, setDragging] = useState(false)

  function takeDroppedPhoto(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onPickFile(file)
  }

  return (
    <Field>
      <FieldLabel htmlFor="character-photo">Photo</FieldLabel>
      <label
        htmlFor="character-photo"
        className={cn(
          "group flex min-h-28 cursor-pointer items-center gap-4 rounded-xl border border-dashed p-3 transition-colors hover:bg-muted/50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          dragging && "border-primary bg-muted"
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={takeDroppedPhoto}
      >
        <PhotoPreview url={photoPreviewUrl} />
        <div className="grid gap-1">
          <span className="flex items-center gap-2 font-medium">
            <UploadCloudIcon className="size-4" />
            {dragging ? "Drop photo here" : "Drop a photo or choose a file"}
          </span>
          <span className="text-sm text-muted-foreground">
            PNG, JPEG, or WebP up to 8 MB
          </span>
        </div>
        <Input
          id="character-photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onPickFile(file)
          }}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldDescription>
          Auto-fill suggests only appearance and photo description. You stay in
          control of the final wording.
        </FieldDescription>
        <Button
          type="button"
          variant="secondary"
          disabled={!canAutofill}
          onClick={onAutofill}
        >
          {autofillState === "loading" ? <Spinner /> : <SparklesIcon />}
          {autofillState === "loading"
            ? "Reading photo…"
            : "Auto-fill from photo"}
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function PhotoPreview({ url }: { url: string }) {
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: preview URLs aren't served by next/image
        <img
          src={url}
          alt="Selected photo preview"
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImagePlusIcon className="size-6" />
        </div>
      )}
    </div>
  )
}
