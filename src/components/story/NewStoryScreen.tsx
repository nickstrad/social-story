"use client"

import { useState } from "react"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStories } from "@/hooks/useStories"

export function NewStoryScreen() {
  const { create } = useStories()
  const [title, setTitle] = useState("")
  const [script, setScript] = useState("")

  return (
    <form
      className="mx-auto grid max-w-3xl gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (!script.trim()) return
        create.mutate({ title: title.trim() || undefined, script })
      }}
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New story</h1>
        <p className="text-muted-foreground">
          Paste your social-story script to get started.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="new-title">
          Title <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="new-title"
          value={title}
          placeholder="Leave blank to name it from the script"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="new-script">
            Story script
          </label>
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
      </div>

      <div>
        <Button type="submit" disabled={!script.trim() || create.isPending}>
          Create story
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  )
}
