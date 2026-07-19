import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { CollectionViewSkeleton } from "@/components/collections/CollectionViewSkeleton"

export function StoryListSkeleton() {
  return (
    <PageLayout>
      {/* The stories header carries a "New story" action. */}
      <PageHeaderSkeleton action />
      <CollectionViewSkeleton screenKey="stories" rows={3}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </CollectionViewSkeleton>
    </PageLayout>
  )
}
