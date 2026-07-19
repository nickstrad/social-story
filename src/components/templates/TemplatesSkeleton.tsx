import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { CollectionViewSkeleton } from "@/components/collections/CollectionViewSkeleton"

export function TemplatesSkeleton() {
  return (
    <PageLayout spacing="relaxed">
      <PageHeaderSkeleton titleClassName="w-40" descriptionClassName="w-96" />
      <CollectionViewSkeleton screenKey="templates" rows={3}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      </CollectionViewSkeleton>
    </PageLayout>
  )
}
