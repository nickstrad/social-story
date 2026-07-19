"use client"

import { useState } from "react"
import { InfoIcon, SparklesIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/PageHeader"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useStoryParse } from "@/hooks/useStoryParse"
import type { ParseState } from "@/lib/parseState"
import type { StoryKind, TaskStatus } from "@/server/domain/types"

const badgeStatus: Record<Exclude<ParseState, "idle">, TaskStatus> = {
  parsing: "RUNNING",
  done: "SUCCEEDED",
  error: "FAILED",
}

function parseButtonLabel(parseState: ParseState) {
  if (parseState === "error") return "Retry parsing"
  return parseState === "done" ? "Re-parse into pages" : "Parse into pages"
}

/**
 * Splitting the script into pages lives here rather than on the Script step: the
 * parse model assigns characters page by page, so it must run after the roster
 * and rules exist. An empty roster is still legal — a fully scene-only book —
 * but it takes an explicit confirmation.
 */
export function ParsePanel({
  storyId,
  storyKind,
  hasCharacters,
}: {
  storyId: string
  storyKind: StoryKind
  hasCharacters: boolean
}) {
  // The parse task polls from here rather than from CharactersScreen so a tick
  // re-renders this panel instead of the whole roster and rule list.
  const { parseState, pageCount, error, canParse, canReparse, onParse } =
    useStoryParse(storyId, storyKind)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isParsing = parseState === "parsing"
  const parsed = parseState === "done"

  return (
    <section className="grid gap-section">
      <PageHeader
        size="section"
        title="Pages"
        description="Split the script into picture-book pages. The cast and rules above decide who appears on each page."
        actions={
          <div className="flex items-center gap-3">
            <Button
              disabled={!canParse || isParsing || (parsed && !canReparse)}
              onClick={() => (hasCharacters ? onParse() : setConfirmOpen(true))}
            >
              <SparklesIcon />
              {parseButtonLabel(parseState)}
            </Button>
            {parseState !== "idle" && (
              <TaskStatusBadge status={badgeStatus[parseState]} error={error} />
            )}
          </div>
        }
      />

      {parsed && storyKind === "TEMPLATE" && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Re-parsing replaces the template pages</AlertTitle>
          <AlertDescription>
            Any page text, prompts, cast selections, and steering edits made
            after the last parse will be replaced.
          </AlertDescription>
        </Alert>
      )}

      {isParsing && <ParsePreview />}

      {parsed && pageCount !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Parsed into {pageCount} pages</CardTitle>
            <CardDescription>
              {hasCharacters
                ? "Continue to the base image, then generate the artwork page by page."
                : "This book is scene-only, so there is no cast to anchor. Continue to Pages to generate the artwork."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parse without any characters?</AlertDialogTitle>
            <AlertDialogDescription>
              No characters are defined — every page will be illustrated without
              people. Add characters first if this story is about someone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Add characters first</AlertDialogCancel>
            <AlertDialogAction onClick={onParse}>
              Parse anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
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
