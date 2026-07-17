"use client"

import { useState } from "react"
import { ArrowRightIcon } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { pageLayoutVariants } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStories } from "@/hooks/useStories"

export function NewStoryScreen() {
  const { create } = useStories()
  const [title, setTitle] = useState("")
  const [script, setScript] = useState("")

  return (
    // The page frame is itself the form element, so this takes the variants
    // directly rather than nesting a PageLayout div inside a <form>.
    <form
      className={pageLayoutVariants({ width: "form" })}
      onSubmit={(event) => {
        event.preventDefault()
        if (!script.trim()) return
        create.mutate({ title: title.trim() || undefined, script })
      }}
    >
      <PageHeader
        title="New story"
        description="Paste your social-story script to get started."
      />

      <Field>
        <FieldLabel htmlFor="new-title">
          Title <span className="text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input
          id="new-title"
          value={title}
          placeholder="Leave blank to name it from the script"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="new-script">Story script</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">
            {script.length.toLocaleString()} / 50,000
          </span>
        </div>
        <Textarea
          id="new-script"
          value={script}
          rows={14}
          maxLength={50_000}
          placeholder="Write the story in plain language…"
          onChange={(event) => setScript(event.target.value)}
        />
      </Field>

      <div>
        <Button type="submit" disabled={!script.trim() || create.isPending}>
          Create story
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  )
}
