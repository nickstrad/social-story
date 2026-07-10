import { Skeleton } from "@/components/ui/skeleton"
export function CharactersSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-10 w-52" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}
