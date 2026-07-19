"use client"

import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function ScriptEditor({
  title,
  script,
  onChangeTitle,
  onChangeScript,
}: {
  title: string
  script: string
  onChangeTitle: (value: string) => void
  onChangeScript: (value: string) => void
}) {
  return (
    <PageLayout width="form">
      <PageHeader
        title="Script"
        description="Paste your social story. Next you'll add the characters, then split it into pages."
      />

      <Field>
        <FieldLabel htmlFor="story-title">
          Title <span className="text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input
          id="story-title"
          value={title}
          placeholder="Leave blank to name it from the script"
          maxLength={200}
          onChange={(event) => onChangeTitle(event.target.value)}
        />
      </Field>

      <Field>
        {/* The live character count sits opposite the label, so this row is
            local layout rather than a FieldDescription. */}
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="story-script">Story script</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">
            {script.length.toLocaleString()} / 50,000
          </span>
        </div>
        <Textarea
          id="story-script"
          value={script}
          rows={14}
          maxLength={50_000}
          placeholder="Write the story in plain language…"
          onChange={(event) => onChangeScript(event.target.value)}
        />
        <FieldDescription>
          Saved as you type. Add your characters next — the story is split into
          pages with the cast in view, so each page knows who belongs in it.
        </FieldDescription>
      </Field>
    </PageLayout>
  )
}
