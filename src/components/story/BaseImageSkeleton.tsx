import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"

export function BaseImageSkeleton() {
  return (
    <PageLayout width="form">
      <PageHeaderSkeleton />
      <div className="grid gap-4 rounded-xl border p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="aspect-square w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
    </PageLayout>
  )
}
