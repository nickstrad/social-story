import { Skeleton } from "@/components/ui/skeleton"

export function PagesEditorSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8">
      <Skeleton className="h-10 w-full max-w-3xl" />
      <div className="grid gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
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
    </div>
  )
}
