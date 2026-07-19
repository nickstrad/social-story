import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { CollectionViewSkeleton } from "@/components/collections/CollectionViewSkeleton"

export function LibrarySkeleton() {
  return (
    <PageLayout width="app" spacing="relaxed">
      <PageHeaderSkeleton
        titleClassName="w-36"
        descriptionClassName="w-96"
        action
      />
      <CollectionViewSkeleton screenKey="character-library" rows={3}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      </CollectionViewSkeleton>
    </PageLayout>
  )
}
