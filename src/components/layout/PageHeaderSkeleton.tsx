import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type PageHeaderSkeletonProps = React.ComponentProps<"div"> & {
  /** Bar widths are the only part that varies per screen. */
  titleClassName?: string
  descriptionClassName?: string
  description?: boolean
  action?: boolean
}

/** The loading stand-in for `PageHeader`. Kept beside it so the two agree on
 *  height and rhythm; a screen only picks the bar widths. */
export function PageHeaderSkeleton({
  className,
  titleClassName = "w-48",
  descriptionClassName = "w-72",
  description = true,
  action = false,
  ...props
}: PageHeaderSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-section",
        className
      )}
      {...props}
    >
      <div className="grid gap-field">
        {/* Sized from the title token itself, so retuning the type scale moves
            the skeleton and the real header together. */}
        <Skeleton
          className={cn("h-(--text-page-title--line-height)", titleClassName)}
        />
        {description && (
          <Skeleton className={cn("h-5", descriptionClassName)} />
        )}
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  )
}
