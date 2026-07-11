import { Skeleton } from "@/components/ui/skeleton"

export function ExportSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-1">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
      <div className="grid gap-4 rounded-xl border p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-56" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  )
}
