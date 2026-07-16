import { Skeleton } from "@/components/ui/skeleton"

export function ArtifactsSkeleton() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-56" />
        ))}
      </div>
    </div>
  )
}
