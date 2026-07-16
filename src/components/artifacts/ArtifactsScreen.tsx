"use client"

import { ArtifactGrid } from "./ArtifactGrid"
import { trpc } from "@/lib/trpc"

export function ArtifactsScreen() {
  const [artifacts] = trpc.artifact.list.useSuspenseQuery()

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Artifacts</h1>
        <p className="text-muted-foreground">
          Every photo, base image, page illustration, and PDF across your
          stories.
        </p>
      </div>
      <ArtifactGrid artifacts={artifacts} />
    </div>
  )
}
