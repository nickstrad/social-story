import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"

export function PagesEditorSkeleton() {
  return (
    <PageLayout width="app" spacing="relaxed">
      {/* Stands in for StoryStepsNav, which is itself form-width. */}
      <Skeleton className="h-10 w-full max-w-form" />
      <PageHeaderSkeleton titleClassName="w-40" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="ml-auto h-8 w-28" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid gap-2 rounded-xl border p-3">
            <Skeleton className="aspect-square w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </PageLayout>
  )
}
