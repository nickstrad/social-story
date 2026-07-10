import { Skeleton } from "@/components/ui/skeleton"

export function ScriptEditorSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-9 w-44" />
    </div>
  )
}
