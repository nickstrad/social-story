"use client"

import Image from "next/image"
import Link from "next/link"
import { FileTextIcon, ImagesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { StepKey } from "@/lib/steps"
import type { Artifact, ArtifactKind } from "@/server/domain/artifacts"

const kindLabels: Record<ArtifactKind, string> = {
  BASE_IMAGE: "Base image",
  CHARACTER_PHOTO: "Photo",
  PAGE_IMAGE: "Page image",
  PDF: "PDF",
}

// Routing stays in the UI: each kind is produced by exactly one wizard step, so
// the click-through is derivable rather than something the server ships. Typed
// as StepKey so a renamed step breaks this at compile time. Every step's path
// segment equals its key (see lib/steps.ts).
const kindStep: Record<ArtifactKind, StepKey> = {
  BASE_IMAGE: "base",
  CHARACTER_PHOTO: "characters",
  PAGE_IMAGE: "pages",
  PDF: "export",
}

const artifactHref = (artifact: Artifact): string =>
  `/stories/${artifact.storyId}/${kindStep[artifact.kind]}`

export function ArtifactGrid({ artifacts }: { artifacts: Artifact[] }) {
  if (artifacts.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImagesIcon />
          </EmptyMedia>
          <EmptyTitle>No artifacts yet</EmptyTitle>
          <EmptyDescription>
            Photos, base images, page art, and exported PDFs show up here as you
            build your stories.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  )
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <Card className="relative overflow-hidden pt-0">
      <div className="relative aspect-video w-full border-b bg-muted">
        {artifact.kind === "PDF" ? (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <FileTextIcon className="size-10" />
          </div>
        ) : (
          <Image
            src={artifact.url}
            alt={artifact.label}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
      </div>
      <CardContent className="grid gap-2">
        <div className="flex items-start justify-between gap-2">
          {/* Covers the card so the whole tile is the click target, while the
              download link below stays reachable via its own stacking context. */}
          <Link
            href={artifactHref(artifact)}
            className="truncate font-medium after:absolute after:inset-0"
          >
            {artifact.label}
          </Link>
          <Badge variant="secondary">{kindLabels[artifact.kind]}</Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {artifact.storyTitle}
        </p>
        <a
          href={artifact.url}
          target="_blank"
          rel="noreferrer"
          className="relative z-10 justify-self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Open original
        </a>
      </CardContent>
    </Card>
  )
}
