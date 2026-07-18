"use client"

import { RefreshCwIcon, SparklesIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

function generationLabel(busy: boolean, failed: boolean, hasImage: boolean) {
  if (busy) return "Generating…"
  if (failed) return "Retry image"
  return hasImage ? "Regenerate" : "Generate image"
}

/**
 * Extra steering text plus the generate/regenerate trigger for the focused
 * page. `hasImage` switches the button between first-generate and regenerate.
 */
export function SteeringBox({
  value,
  onChange,
  onGenerate,
  hasImage,
  busy,
  uploading,
  failed,
  onUpload,
}: {
  value: string
  onChange: (value: string) => void
  onGenerate: () => void
  hasImage: boolean
  busy: boolean
  uploading: boolean
  failed: boolean
  onUpload: () => void
}) {
  const actionLabel = generationLabel(busy, failed, hasImage)

  return (
    <Field>
      <FieldLabel htmlFor="steering">Steering</FieldLabel>
      <Textarea
        id="steering"
        rows={2}
        placeholder="Extra direction for this image (mood, framing, details)…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={onGenerate} disabled={busy || uploading}>
          {hasImage ? <RefreshCwIcon /> : <SparklesIcon />}
          {actionLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onUpload}
          disabled={busy || uploading}
        >
          <UploadIcon />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        PNG, JPEG or WebP, up to 8 MB
      </p>
    </Field>
  )
}
