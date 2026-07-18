import { PageHeaderSkeleton } from "@/components/layout/PageHeaderSkeleton"
import { PageLayout } from "@/components/layout/PageLayout"
import { Skeleton } from "@/components/ui/skeleton"

export function TemplatesSkeleton() {
  return (
    <PageLayout spacing="relaxed">
      <PageHeaderSkeleton titleClassName="w-40" descriptionClassName="w-96" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
    </PageLayout>
  )
}
