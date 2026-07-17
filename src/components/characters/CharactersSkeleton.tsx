import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"

export function CharactersSkeleton() {
  return (
    <PageLayout spacing="relaxed">
      <PageHeaderSkeleton titleClassName="w-52" action />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-40" />
    </PageLayout>
  )
}
