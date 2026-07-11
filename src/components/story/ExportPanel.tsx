"use client"

import Link from "next/link"
import { DownloadIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge"
import type { ExportPageRef } from "@/lib/exportReadiness"
import { isActiveStatus } from "@/server/domain/taskMachine"
import type { TaskStatus } from "@/server/domain/types"

export function ExportPanel({
  storyId,
  readyPages,
  missingPages,
  taskState,
  pdfUrl,
  onExport,
}: {
  storyId: string
  readyPages: ExportPageRef[]
  missingPages: ExportPageRef[]
  taskState?: TaskStatus
  pdfUrl?: string
  onExport: () => void
}) {
  const busy = isActiveStatus(taskState)
  const canExport = missingPages.length === 0 && readyPages.length > 0 && !busy

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="grid gap-1">
          <CardTitle>Export PDF</CardTitle>
          <CardDescription>
            Assemble the cover and every visible page — in order — into a single
            PDF to download.
          </CardDescription>
        </div>
        {taskState && <TaskStatusBadge status={taskState} />}
      </CardHeader>
      <CardContent className="grid gap-4">
        {missingPages.length > 0 ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              {missingPages.length} page
              {missingPages.length === 1 ? "" : "s"} still need an image
            </AlertTitle>
            <AlertDescription>
              <span>Generate or select an image for each, then export:</span>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {missingPages.map((page) => (
                  <li key={page.pageId}>
                    <Link
                      href={`/stories/${storyId}/pages?focus=${page.pageId}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            {readyPages.length} page{readyPages.length === 1 ? "" : "s"} ready to
            export.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {busy && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Building your PDF…
            </span>
          )}
          {pdfUrl && !busy && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <DownloadIcon />
              Download PDF
            </a>
          )}
          <Button onClick={onExport} disabled={!canExport}>
            <FileTextIcon />
            {pdfUrl ? "Re-export" : "Export PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
