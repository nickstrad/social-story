"use client"

import { ArtifactGrid } from "./ArtifactGrid"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageLayout } from "@/components/layout/PageLayout"
import { trpc } from "@/lib/trpc"

export function ArtifactsScreen() {
  const [artifacts] = trpc.artifact.list.useSuspenseQuery()

  return (
    <PageLayout>
      <PageHeader
        title="Artifacts"
        description="Every photo, base image, page illustration, and PDF across your stories."
      />
      <ArtifactGrid artifacts={artifacts} />
    </PageLayout>
  )
}
