import { Skeleton } from "@/components/ui/skeleton"

export function BaseImageSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 rounded-xl border p-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="aspect-square w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
    </div>
  )
}
