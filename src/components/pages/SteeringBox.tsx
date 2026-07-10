"use client"

import { RefreshCwIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

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
}: {
  value: string
  onChange: (value: string) => void
  onGenerate: () => void
  hasImage: boolean
  busy: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="steering">Steering</Label>
      <Textarea
        id="steering"
        rows={2}
        placeholder="Extra direction for this image (mood, framing, details)…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button onClick={onGenerate} disabled={busy}>
        {hasImage ? <RefreshCwIcon /> : <SparklesIcon />}
        {busy ? "Generating…" : hasImage ? "Regenerate" : "Generate image"}
      </Button>
    </div>
  )
}
