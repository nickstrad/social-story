import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"

export function ScriptEditorSkeleton() {
  return (
    <PageLayout width="form">
      <PageHeaderSkeleton titleClassName="w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-9 w-44" />
    </PageLayout>
  )
}
