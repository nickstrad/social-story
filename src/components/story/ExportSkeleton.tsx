import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"

export function ExportSkeleton() {
  return (
    <PageLayout width="form" spacing="relaxed">
      <Skeleton className="h-9 w-full" />
      <PageHeaderSkeleton titleClassName="w-40" />
      <div className="grid gap-4 rounded-xl border p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-56" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </PageLayout>
  )
}
