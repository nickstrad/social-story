"use client"

import { SparklesIcon } from "lucide-react"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { TaskStatus } from "@/server/domain/types"
import type { ParseState } from "@/lib/parseState"

const badgeStatus: Record<Exclude<ParseState, "idle">, TaskStatus> = {
  parsing: "RUNNING",
  done: "SUCCEEDED",
  error: "FAILED",
}

function parseButtonLabel(parseState: ParseState, parsed: boolean) {
  if (parseState === "error") return "Retry parsing"
  return parsed ? "Re-parse into pages" : "Parse into pages"
}

export function ScriptEditor({
  title,
  script,
  parseState,
  pageCount,
  error,
  canReparse,
  onChangeTitle,
  onChangeScript,
  onParse,
}: {
  title: string
  script: string
  parseState: ParseState
  pageCount?: number
  error?: string
  canReparse: boolean
  onChangeTitle: (value: string) => void
  onChangeScript: (value: string) => void
  onParse: () => void
}) {
  const isParsing = parseState === "parsing"
  const parsed = parseState === "done"
  const parseLabel = parseButtonLabel(parseState, parsed)

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Script</h1>
        <p className="text-muted-foreground">
          Paste your social story. We&apos;ll split it into picture-book pages.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="story-title">
          Title <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="story-title"
          value={title}
          placeholder="Leave blank to name it from the script"
          maxLength={200}
          onChange={(event) => onChangeTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="story-script">
            Story script
          </label>
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
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={onParse}
          disabled={!script.trim() || isParsing || (parsed && !canReparse)}
        >
          <SparklesIcon />
          {parseLabel}
        </Button>
        {parseState !== "idle" && (
          <TaskStatusBadge status={badgeStatus[parseState]} error={error} />
        )}
      </div>

      {isParsing && <ParsePreview />}

      {parsed && pageCount !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Parsed into {pageCount} pages</CardTitle>
            <CardDescription>
              Continue to characters, then generate the artwork page by page.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

function ParsePreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Splitting into pages…</CardTitle>
        <CardDescription>This usually takes a few moments.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}
