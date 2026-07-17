"use client"

import Link from "next/link"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StepKey, StepState } from "@/lib/steps"

export function StoryStepsNav({
  storyId,
  steps,
  current,
}: {
  storyId: string
  steps: StepState[]
  current: StepKey
}) {
  return (
    <nav className="mx-auto flex max-w-form flex-wrap items-center gap-1 border-b pb-3">
      {steps.map((step, index) => {
        const active = step.key === current
        const content = (
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-xs tabular-nums",
                step.done &&
                  "border-transparent bg-primary text-primary-foreground",
                active && !step.done && "border-primary text-primary"
              )}
            >
              {step.done ? <CheckIcon className="size-3" /> : index + 1}
            </span>
            {step.label}
          </span>
        )
        const className = cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-muted text-foreground"
            : step.enabled
              ? "text-muted-foreground hover:text-foreground"
              : "cursor-not-allowed text-muted-foreground/50"
        )
        return step.enabled && !active ? (
          <Link
            key={step.key}
            href={`/stories/${storyId}/${step.segment}`}
            className={className}
          >
            {content}
          </Link>
        ) : (
          <span
            key={step.key}
            aria-current={active ? "step" : undefined}
            aria-disabled={!step.enabled}
            className={className}
          >
            {content}
          </span>
        )
      })}
    </nav>
  )
}
